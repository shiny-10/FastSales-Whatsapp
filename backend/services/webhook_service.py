from __future__ import annotations
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

# Only import models/schemas at module level — no service imports here
# All service imports are deferred inside __init__ to break circular chains
from models.postgres_model import WhatsAppInboxMessage
from schemas.whatsapp_inbox import MessageResponse, ReactionResponse, SendTextMessageRequest
import services.socket_service as socket_svc

STATUS_MAP = {
    "sent": "SENT",
    "delivered": "DELIVERED",
    "read": "READ",
    "failed": "FAILED",
}

TYPE_MAP = {
    "text": "TEXT",
    "image": "IMAGE",
    "video": "VIDEO",
    "audio": "AUDIO",
    "document": "DOCUMENT",
    "sticker": "STICKER",
    "location": "LOCATION",
    "contacts": "CONTACTS",
    "interactive": "INTERACTIVE",
    "template": "TEMPLATE",
    "reaction": "REACTION",
}

class WebhookService:
    def __init__(self, db: Session):
        self.db = db
        # All service imports are lazy to prevent circular import errors.
        # Python caches modules after first load so there is no performance cost.
        from services.whatsapp_service import WhatsAppRepository
        from services.conversation_service import ConversationRepository, ConversationService
        from services.message_service import MessageRepository
        from services.reaction_service import ReactionService
        from services.media_service import MediaService
        from services.messaging_features_service import AutoReplyService, ChatbotRuleService

        self.wa_repo = WhatsAppRepository(db)
        self.conv_repo = ConversationRepository(db)
        self.msg_repo = MessageRepository(db)
        self.conv_svc = ConversationService(db)
        self.reaction_svc = ReactionService(db)
        self.media_svc = MediaService(db)

    def process_payload(self, payload: dict) -> None:
        """Entry point for POST /webhooks/meta."""
        object_type = payload.get("object")
        if object_type != "whatsapp_business_account":
            return

        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                field = change.get("field")
                value = change.get("value", {})

                if field in {
                    "messages",
                    "statuses",
                    "message_statuses",
                    "message_template_status_update",
                    "reaction",
                    "message_reactions",
                }:
                    self._handle_messages_change(value)

    def _handle_messages_change(self, value: dict) -> None:
        metadata = value.get("metadata") or {}
        phone_number_id = metadata.get("phone_number_id")
        normalized_phone_number_id = str(phone_number_id) if phone_number_id is not None else None

        wa_account = None
        if normalized_phone_number_id:
            wa_account = self.wa_repo.get_by_phone_number_id(normalized_phone_number_id)

        if not wa_account:
            from core.config import settings as config
            configured_phone_number_id = getattr(config, "META_WHATSAPP_PHONE_NUMBER_ID", "") or ""
            if configured_phone_number_id and str(configured_phone_number_id) != normalized_phone_number_id:
                wa_account = self.wa_repo.get_by_phone_number_id(str(configured_phone_number_id))

        if not wa_account:
            wa_account = self.wa_repo.get_fallback_account()

        if not wa_account:
            wa_account = self.wa_repo.get_any_active_account()

        if not wa_account:
            return

        organization_id = wa_account.organization_id

        # Handle incoming messages
        contacts = value.get("contacts") or []
        for msg_data in value.get("messages", []):
            self._handle_incoming_message(msg_data, wa_account, organization_id, contacts)

        # Handle status updates
        for status_data in value.get("statuses", []):
            self._handle_status_update(status_data, organization_id)

    def _handle_incoming_message(
        self, msg_data: dict, wa_account, organization_id: int, contacts: Optional[list[dict]] = None
    ) -> None:
        meta_msg_id = msg_data.get("id")
        from_phone = msg_data.get("from")
        timestamp = msg_data.get("timestamp")
        msg_type_str = msg_data.get("type", "text")

        # Deduplicate
        existing = self.msg_repo.get_by_meta_id(meta_msg_id)
        if existing:
            return

        # Resolve contact name
        customer_name = None
        resolved_contacts = contacts or msg_data.get("contacts") or []
        if resolved_contacts:
            customer_name = resolved_contacts[0].get("profile", {}).get("name")

        # Get or create conversation
        conversation, is_new = self.conv_svc.get_or_create(
            organization_id=organization_id,
            customer_phone=from_phone,
            whatsapp_account_id=wa_account.id,
            customer_name=customer_name,
        )

        # Handle reaction type separately
        if msg_type_str == "reaction":
            self._handle_reaction(
                msg_data, conversation, organization_id
            )
            return

        # Extract content
        content, caption, media_info = self._extract_content(msg_data, msg_type_str)
        msg_type = TYPE_MAP.get(msg_type_str, "UNSUPPORTED")

        # Create message record
        message = self.msg_repo.create(
            conversation_id=conversation.id,
            meta_message_id=meta_msg_id,
            sender_type="CUSTOMER",
            message_type=msg_type,
            content=content,
            caption=caption,
            status="DELIVERED",
        )

        # Process media
        if media_info:
            try:
                self.media_svc.process_incoming_media(
                    message_id=message.id,
                    media_id=media_info.get("id"),
                    access_token=wa_account.access_token,
                    mime_type=media_info.get("mime_type"),
                    file_name=media_info.get("filename"),
                )
            except Exception:
                pass

        # Update conversation
        try:
            ts = datetime.utcfromtimestamp(int(timestamp)) if timestamp else datetime.utcnow()
        except Exception:
            ts = datetime.utcnow()

        self.conv_repo.update(
            conversation.id,
            last_message_at=ts,
            customer_last_seen_at=ts,   # track when customer was last active
            # Customer replied → conversation is now active/open, not waiting
            status="OPEN",
        )
        self.conv_repo.increment_unread(conversation.id)

        # Reload with relations
        msg_for_broadcast = self.msg_repo.get_by_id(message.id)

        # Broadcast
        socket_svc.emit_new_message(
            organization_id,
            conversation.id,
            MessageResponse.model_validate(msg_for_broadcast),
        )
        # Notify clients that conversation moved back to OPEN
        socket_svc.emit_conversation_update(
            organization_id, conversation.id, {"status": "OPEN"}
        )

        # Auto-reply / chatbot (run synchronously)
        if content and msg_type == "TEXT":
            self._try_auto_respond(content, conversation, organization_id, wa_account)

    def _try_auto_respond(self, text: str, conversation, organization_id: int, wa_account) -> None:
        from services.message_service import MessageService
        from services.messaging_features_service import AutoReplyService, ChatbotRuleService
        try:
            chatbot_svc = ChatbotRuleService(self.db)
            rules = chatbot_svc.get_active(organization_id)
            matched = chatbot_svc.match(rules, text)
            if matched:
                rendered = self._render_template(matched.response, conversation, text)
                if self._should_skip_reply(conversation.id, rendered):
                    return

                svc = MessageService(self.db)
                req = SendTextMessageRequest(conversation_id=conversation.id, content=rendered)
                system_agent_id = 0
                reply = svc.send_text_message(req, system_agent_id, wa_account.phone_number_id, wa_account.access_token)
                socket_svc.emit_new_message(organization_id, conversation.id, MessageResponse.model_validate(reply))
                return

            auto_svc = AutoReplyService(self.db)
            auto_replies = auto_svc.get_active(organization_id)
            if auto_replies:
                rendered = self._render_template(auto_replies[0].message, conversation, text)
                if self._should_skip_reply(conversation.id, rendered):
                    return
                svc = MessageService(self.db)
                req = SendTextMessageRequest(conversation_id=conversation.id, content=rendered)
                system_agent_id = 0
                reply = svc.send_text_message(req, system_agent_id, wa_account.phone_number_id, wa_account.access_token)
                socket_svc.emit_new_message(organization_id, conversation.id, MessageResponse.model_validate(reply))
        except Exception:
            pass

    def _render_template(self, template: str, conversation, incoming_text: str) -> str:
        class _SafeDict(dict):
            def __missing__(self, key):
                return ""

        ctx = _SafeDict(
            {
                "customer_name": conversation.customer_name or "",
                "customer_phone": conversation.customer_phone or "",
                "conversation_id": str(conversation.id),
                "last_message": incoming_text or "",
            }
        )
        try:
            return template.format_map(ctx)
        except Exception:
            return template

    def _should_skip_reply(self, conversation_id: int, reply_text: str, recent_agent_window_seconds: int = 120) -> bool:
        msgs, _ = self.msg_repo.list_by_conversation(conversation_id, page_size=20)
        now = datetime.utcnow()

        # Check for recent agent reply
        for m in reversed(msgs):
            if m.sender_type == "AGENT":
                if hasattr(m, "created_at") and m.created_at:
                    delta = (now - m.created_at).total_seconds()
                    if delta <= recent_agent_window_seconds:
                        return True
                break

        # Check if same reply already sent by an agent
        for m in msgs:
            if m.sender_type == "AGENT" and (m.content or "").strip() == (reply_text or "").strip():
                return True

        return False

    def _handle_status_update(self, status_data: dict, organization_id: int) -> None:
        meta_msg_id = status_data.get("id")
        status_str = status_data.get("status")
        new_status = STATUS_MAP.get(status_str)

        if not new_status:
            return

        msg = self.msg_repo.get_by_meta_id(meta_msg_id)
        if not msg:
            # Still try to update MessageLog + CampaignRecipient by meta message id
            self._sync_campaign_status(meta_msg_id, new_status)
            return

        self.msg_repo.update_status_by_meta_id(meta_msg_id, new_status)

        # ── Also sync to MessageLog and CampaignRecipient ──────────────────
        # This is what makes the campaign delivery report show correct statuses.
        self._sync_campaign_status(meta_msg_id, new_status)

        conv = self.conv_repo.get_by_id(msg.conversation_id)
        if conv:
            if new_status in ("SENT", "DELIVERED") and msg.sender_type == "AGENT":
                if conv.status not in ("PENDING",):
                    self.conv_repo.update(conv.id, status="PENDING")
                    socket_svc.emit_conversation_update(
                        organization_id, conv.id, {"status": "PENDING"}
                    )
            elif new_status == "READ" and msg.sender_type == "AGENT":
                if conv.status == "PENDING":
                    self.conv_repo.update(conv.id, status="OPEN")
                    socket_svc.emit_conversation_update(
                        organization_id, conv.id, {"status": "OPEN"}
                    )

            socket_svc.emit_message_status(
                organization_id,
                msg.conversation_id,
                new_status,
                msg.id,
                meta_msg_id,
            )

    def _sync_campaign_status(self, meta_msg_id: str, new_status: str) -> None:
        """
        Propagate a Meta delivery status (SENT/DELIVERED/READ/FAILED) to
        MessageLog and CampaignRecipient rows that reference this meta message id.
        Maps our internal status names to lowercase for legacy tables.
        """
        if not meta_msg_id:
            return
        # Map to lowercase for legacy tables (MessageLog / CampaignRecipient)
        legacy_status = new_status.lower()   # DELIVERED → delivered, READ → read, etc.
        try:
            from models.postgres_model import MessageLog, CampaignRecipient

            # Update MessageLog
            msg_log = self.db.query(MessageLog).filter(
                MessageLog.message_id == meta_msg_id
            ).first()
            if msg_log:
                msg_log.status = legacy_status
                self.db.commit()

            # Update CampaignRecipient
            rec = self.db.query(CampaignRecipient).filter(
                CampaignRecipient.message_id == meta_msg_id
            ).first()
            if rec:
                rec.status = legacy_status
                self.db.commit()
        except Exception:
            pass

    def _handle_reaction(
        self, msg_data: dict, conversation, organization_id: int
    ) -> None:
        reaction_data = msg_data.get("reaction", {})
        meta_msg_id = reaction_data.get("message_id")
        emoji = reaction_data.get("emoji", "")
        from_phone = msg_data.get("from")

        reaction = self.reaction_svc.handle_reaction(
            meta_message_id=meta_msg_id,
            emoji=emoji,
            customer_phone=from_phone,
        )
        if reaction:
            socket_svc.emit_new_reaction(
                organization_id,
                conversation.id,
                ReactionResponse.model_validate(reaction),
            )

    @staticmethod
    def _extract_content(
        msg_data: dict, msg_type: str
    ) -> tuple[Optional[str], Optional[str], Optional[dict]]:
        """Returns (content, caption, media_info)."""
        if msg_type == "text":
            text_obj = msg_data.get("text", {})
            return text_obj.get("body"), None, None

        elif msg_type in ("image", "video", "audio", "document", "sticker"):
            media = msg_data.get(msg_type, {})
            caption = media.get("caption")
            return None, caption, media

        elif msg_type == "location":
            loc = msg_data.get("location", {})
            content = f"lat:{loc.get('latitude')},lon:{loc.get('longitude')}"
            return content, None, None

        elif msg_type == "interactive":
            interactive = msg_data.get("interactive", {})
            resp_type = interactive.get("type")
            if resp_type == "button_reply":
                btn = interactive.get("button_reply", {})
                return btn.get("title"), None, None
            elif resp_type == "list_reply":
                lst = interactive.get("list_reply", {})
                return lst.get("title"), None, None

        return None, None, None
