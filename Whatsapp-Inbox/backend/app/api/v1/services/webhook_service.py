"""Process incoming Meta webhook payloads."""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.core.config import settings
from app.api.core.logging import get_logger
from app.db.repositories.whatsapp_repository import WhatsAppRepository
from app.db.repositories.conversation_repository import ConversationRepository
from app.db.repositories.message_repository import MessageRepository
from app.api.v1.services.conversation_service import ConversationService
from app.api.v1.services.reaction_service import ReactionService
from app.api.v1.services.media_service import MediaService
from app.api.v1.services.messaging_features_service import AutoReplyService, ChatbotRuleService
from app.db.models import Message, SenderType, MessageType, MessageStatus
from app.api.v1.schemas.message import MessageResponse, ReactionResponse, SendTextMessageRequest
import app.api.v1.services.socket_service as socket_svc

logger = get_logger(__name__)

# Map Meta status strings → our enum
STATUS_MAP = {
    "sent": MessageStatus.SENT,
    "delivered": MessageStatus.DELIVERED,
    "read": MessageStatus.READ,
    "failed": MessageStatus.FAILED,
}

# Map Meta message types → our enum
TYPE_MAP = {
    "text": MessageType.TEXT,
    "image": MessageType.IMAGE,
    "video": MessageType.VIDEO,
    "audio": MessageType.AUDIO,
    "document": MessageType.DOCUMENT,
    "sticker": MessageType.STICKER,
    "location": MessageType.LOCATION,
    "contacts": MessageType.CONTACTS,
    "interactive": MessageType.INTERACTIVE,
    "template": MessageType.TEMPLATE,
    "reaction": MessageType.REACTION,
}


class WebhookService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.wa_repo = WhatsAppRepository(db)
        self.conv_repo = ConversationRepository(db)
        self.msg_repo = MessageRepository(db)
        self.conv_svc = ConversationService(db)
        self.reaction_svc = ReactionService(db)
        self.media_svc = MediaService(db)

    async def process_payload(self, payload: dict) -> None:
        """Entry point for POST /webhooks/meta."""
        object_type = payload.get("object")
        if object_type != "whatsapp_business_account":
            logger.warning(f"Unknown webhook object: {object_type}")
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
                    await self._handle_messages_change(value)
                else:
                    logger.debug(f"Unhandled webhook field: {field}")

    async def _handle_messages_change(self, value: dict) -> None:
        logger.info(f"[WEBHOOK] Processing value with keys: {list(value.keys())}")
        metadata = value.get("metadata") or {}
        phone_number_id = metadata.get("phone_number_id")
        normalized_phone_number_id = str(phone_number_id) if phone_number_id is not None else None
        logger.info(f"[WEBHOOK] Phone number ID: {normalized_phone_number_id}")

        wa_account = None
        if normalized_phone_number_id:
            wa_account = await self.wa_repo.get_by_phone_number_id(normalized_phone_number_id)
            logger.info(f"[WEBHOOK] Lookup by phone_number_id: {'Found' if wa_account else 'Not found'}")

        if not wa_account:
            configured_phone_number_id = getattr(settings, "META_WHATSAPP_PHONE_NUMBER_ID", "") or ""
            logger.info(f"[WEBHOOK] Configured phone_number_id: {configured_phone_number_id}")
            if configured_phone_number_id and str(configured_phone_number_id) != normalized_phone_number_id:
                wa_account = await self.wa_repo.get_by_phone_number_id(str(configured_phone_number_id))
                logger.info(f"[WEBHOOK] Lookup by configured ID: {'Found' if wa_account else 'Not found'}")

        if not wa_account:
            wa_account = await self.wa_repo.get_fallback_account()
            logger.info(f"[WEBHOOK] Fallback account: {'Found' if wa_account else 'Not found'}")

        if not wa_account:
            wa_account = await self.wa_repo.get_any_active_account()
            logger.info(f"[WEBHOOK] Any active account fallback: {'Found' if wa_account else 'Not found'}")

        if not wa_account:
            logger.warning(
                "[WEBHOOK] No WhatsApp account matched webhook phone_number_id=%s configured_phone_number_id=%s",
                phone_number_id,
                getattr(settings, "META_WHATSAPP_PHONE_NUMBER_ID", ""),
            )
            return

        company_id = wa_account.company_id
        logger.info(f"[WEBHOOK] Using account {wa_account.id} with company_id {company_id}")

        # Handle incoming messages
        contacts = value.get("contacts") or []
        msg_count = len(value.get("messages", []))
        logger.info(f"[WEBHOOK] Processing {msg_count} messages and {len(value.get('statuses', []))} statuses")
        for msg_data in value.get("messages", []):
            await self._handle_incoming_message(msg_data, wa_account, company_id, contacts)

        # Handle status updates
        for status_data in value.get("statuses", []):
            await self._handle_status_update(status_data, company_id)

    async def _handle_incoming_message(
        self, msg_data: dict, wa_account, company_id, contacts: Optional[list[dict]] = None
    ) -> None:
        meta_msg_id = msg_data.get("id")
        from_phone = msg_data.get("from")
        timestamp = msg_data.get("timestamp")
        msg_type_str = msg_data.get("type", "text")
        
        logger.info(f"[MSG] Handling message: id={meta_msg_id}, from={from_phone}, type={msg_type_str}")

        # Deduplicate
        existing = await self.msg_repo.get_by_meta_id(meta_msg_id)
        if existing:
            logger.debug(f"[MSG] Duplicate webhook message: {meta_msg_id}")
            return

        logger.info(f"[MSG] Message is new, creating...")

        # Resolve contact name
        customer_name = None
        resolved_contacts = contacts or msg_data.get("contacts") or []
        if resolved_contacts:
            customer_name = resolved_contacts[0].get("profile", {}).get("name")
        logger.info(f"[MSG] Customer name: {customer_name}")

        # Get or create conversation
        conversation, is_new = await self.conv_svc.get_or_create(
            company_id=company_id,
            customer_phone=from_phone,
            whatsapp_account_id=wa_account.id,
            customer_name=customer_name,
        )
        logger.info(f"[MSG] Conversation: {conversation.id} (new={is_new})")

        # Handle reaction type separately
        if msg_type_str == "reaction":
            await self._handle_reaction(
                msg_data, conversation, company_id
            )
            return

        # Extract content
        content, caption, media_info = self._extract_content(msg_data, msg_type_str)
        msg_type = TYPE_MAP.get(msg_type_str, MessageType.UNSUPPORTED)
        logger.info(f"[MSG] Content extracted: content_len={len(content) if content else 0}, has_media={bool(media_info)}")

        # Create message record
        message = await self.msg_repo.create(
            conversation_id=conversation.id,
            meta_message_id=meta_msg_id,
            sender_type=SenderType.CUSTOMER,
            message_type=msg_type,
            content=content,
            caption=caption,
            status=MessageStatus.DELIVERED,
        )

        # Process media
        if media_info:
            try:
                await self.media_svc.process_incoming_media(
                    message_id=message.id,
                    media_id=media_info.get("id"),
                    access_token=wa_account.access_token,
                    mime_type=media_info.get("mime_type"),
                    file_name=media_info.get("filename"),
                )
            except Exception as e:
                logger.error(f"Media processing error: {e}")

        # Update conversation
        ts = datetime.fromtimestamp(int(timestamp), tz=timezone.utc) if timestamp else datetime.now(timezone.utc)
        await self.conv_repo.update(
            conversation.id,
            last_message_at=ts,
        )
        await self.conv_repo.increment_unread(conversation.id)

        # Broadcast
        msg_for_broadcast = await self.msg_repo.get_by_id(message.id)
        await socket_svc.emit_new_message(
            str(company_id),
            str(conversation.id),
            MessageResponse.model_validate(msg_for_broadcast),
        )
        logger.info(
            f"Incoming message processed: {meta_msg_id} conv={conversation.id}"
        )

        # Auto-reply / chatbot (fire-and-forget, don't block webhook response)
        if content and msg_type == MessageType.TEXT:
            await self._try_auto_respond(content, conversation, company_id, wa_account)

    async def _try_auto_respond(self, text: str, conversation, company_id, wa_account) -> None:
        """Check chatbot rules first, then auto-replies.

        Adds simple templating and light context checks to avoid loops:
        - Render placeholders in responses using conversation context
        - Skip if an agent replied recently or same reply already exists
        """
        from app.api.v1.services.message_service import MessageService
        from uuid import UUID as _UUID
        try:
            chatbot_svc = ChatbotRuleService(self.db)
            rules = await chatbot_svc.get_active(company_id)
            matched = chatbot_svc.match(rules, text)
            if matched:
                rendered = await self._render_template(matched.response, conversation, text)
                if await self._should_skip_reply(conversation.id, rendered):
                    return

                svc = MessageService(self.db)
                req = SendTextMessageRequest(conversation_id=conversation.id, content=rendered)
                system_agent_id = _UUID("00000000-0000-0000-0000-000000000000")
                reply = await svc.send_text_message(req, system_agent_id, wa_account.phone_number_id, wa_account.access_token)
                await socket_svc.emit_new_message(str(company_id), str(conversation.id), MessageResponse.model_validate(reply))
                return

            auto_svc = AutoReplyService(self.db)
            auto_replies = await auto_svc.get_active(company_id)
            if auto_replies:
                rendered = await self._render_template(auto_replies[0].message, conversation, text)
                if await self._should_skip_reply(conversation.id, rendered):
                    return
                svc = MessageService(self.db)
                req = SendTextMessageRequest(conversation_id=conversation.id, content=rendered)
                system_agent_id = _UUID("00000000-0000-0000-0000-000000000000")
                reply = await svc.send_text_message(req, system_agent_id, wa_account.phone_number_id, wa_account.access_token)
                await socket_svc.emit_new_message(str(company_id), str(conversation.id), MessageResponse.model_validate(reply))
        except Exception as e:
            logger.error("Auto-respond failed: %s", e)

    async def _render_template(self, template: str, conversation, incoming_text: str) -> str:
        """Render simple {placeholder} templates from conversation context.

        Uses Python str.format_map with a safe dict to avoid KeyError on missing keys.
        Available keys: customer_name, customer_phone, conversation_id, last_message
        """
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

    async def _should_skip_reply(self, conversation_id, reply_text, recent_agent_window_seconds: int = 120) -> bool:
        """Return True if a reply should be skipped based on simple context rules:
        - If the conversation has an agent message within `recent_agent_window_seconds` seconds, skip.
        - If the exact same reply_text was already sent by an agent in the conversation, skip.
        """
        from datetime import datetime, timezone
        # Load recent messages for the conversation
        msgs, _ = await self.msg_repo.list_by_conversation(conversation_id, page_size=20)
        now = datetime.now(timezone.utc)

        # Check for recent agent reply
        for m in reversed(msgs):
            if m.sender_type == SenderType.AGENT:
                if hasattr(m, "created_at") and m.created_at:
                    delta = (now - m.created_at).total_seconds()
                    if delta <= recent_agent_window_seconds:
                        logger.debug("Skipping auto-reply: agent replied %.1fs ago", delta)
                        return True
                break

        # Check if same reply already sent by an agent
        for m in msgs:
            if m.sender_type == SenderType.AGENT and (m.content or "").strip() == (reply_text or "").strip():
                logger.debug("Skipping auto-reply: same reply already sent in conversation %s", conversation_id)
                return True

        return False

    async def _handle_status_update(self, status_data: dict, company_id) -> None:
        meta_msg_id = status_data.get("id")
        status_str = status_data.get("status")
        new_status = STATUS_MAP.get(status_str)

        if not new_status:
            return

        msg = await self.msg_repo.get_by_meta_id(meta_msg_id)
        if not msg:
            logger.debug(f"Status update for unknown message: {meta_msg_id}")
            return

        await self.msg_repo.update_status_by_meta_id(meta_msg_id, new_status)

        conv = await self.conv_repo.get_by_id(msg.conversation_id)
        if conv:
            await socket_svc.emit_message_status(
                str(company_id),
                str(msg.conversation_id),
                new_status.value,
                str(msg.id),
                meta_msg_id,
            )

    async def _handle_reaction(
        self, msg_data: dict, conversation, company_id
    ) -> None:
        reaction_data = msg_data.get("reaction", {})
        meta_msg_id = reaction_data.get("message_id")
        emoji = reaction_data.get("emoji", "")
        from_phone = msg_data.get("from")

        reaction = await self.reaction_svc.handle_reaction(
            meta_message_id=meta_msg_id,
            emoji=emoji,
            customer_phone=from_phone,
        )
        if reaction:
            await socket_svc.emit_new_reaction(
                str(company_id),
                str(conversation.id),
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
