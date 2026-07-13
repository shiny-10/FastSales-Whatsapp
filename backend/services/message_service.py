from __future__ import annotations
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session, joinedload
from models.postgres_model import WhatsAppInboxMessage
from typing import Optional
from datetime import datetime
import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from services.conversation_service import ConversationRepository
from services.whatsapp_service import WhatsAppRepository
from models.postgres_model import WhatsAppInboxMessage
from schemas.whatsapp_inbox import (
    SendTextMessageRequest,
    SendMediaMessageRequest,
    SendTemplateMessageRequest,
    MessageListResponse,
    MessageResponse,
)
import services.socket_service as socket_svc

class MessageService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = MessageRepository(db)
        self.conv_repo = ConversationRepository(db)

    def _meta_url(self, phone_number_id: str) -> str:
        meta_base_url = getattr(config, "META_BASE_URL", "https://graph.facebook.com")
        meta_api_version = getattr(config, "META_API_VERSION", "v23.0")
        return f"{meta_base_url}/{meta_api_version}/{phone_number_id}/messages"

    def _post_to_meta(
        self, phone_number_id: str, access_token: str, payload: dict
    ) -> dict:
        url = self._meta_url(phone_number_id)
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        with httpx.Client(timeout=30.0) as client:
            try:
                resp = client.post(url, json=payload, headers=headers)
                text = resp.text
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPStatusError as e:
                status_code = e.response.status_code if e.response is not None else None
                text = e.response.text if e.response is not None else str(e)
                if status_code == 401 and e.response is not None:
                    try:
                        error_json = e.response.json()
                        error_data = error_json.get("error", {})
                        if error_data.get("code") == 190:
                            self._deactivate_invalid_account(phone_number_id)
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail=(
                                    "WhatsApp access token is invalid or expired. "
                                    "Please reconnect your WhatsApp account."
                                ),
                            )
                    except ValueError:
                        pass
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Meta API error: {text}",
                )
            except httpx.RequestError as e:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Meta request error: {str(e)}",
                )

    def _deactivate_invalid_account(self, phone_number_id: str) -> None:
        wa_repo = WhatsAppRepository(self.db)
        account = wa_repo.get_by_phone_number_id(phone_number_id)
        if account:
            wa_repo.update(account.id, status="DISCONNECTED")

    def send_text_message(
        self,
        request: SendTextMessageRequest,
        agent_id: int,
        phone_number_id: str,
        access_token: str,
    ) -> WhatsAppInboxMessage:
        conv = self.conv_repo.get_by_id(request.conversation_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")

        message = self.repo.create(
            conversation_id=request.conversation_id,
            meta_message_id=None,
            sender_type="AGENT",
            sender_id=agent_id,
            message_type="TEXT",
            content=request.content,
            status="PENDING",
            reply_to_message_id=request.reply_to_message_id,
        )

        payload = {
            "messaging_product": "whatsapp",
            "to": conv.customer_phone,
            "type": "text",
            "text": {"body": request.content, "preview_url": False},
        }

        if request.reply_to_message_id:
            orig = self.repo.get_by_id(request.reply_to_message_id)
            if orig and orig.meta_message_id:
                payload["context"] = {"message_id": orig.meta_message_id}

        try:
            result = self._post_to_meta(phone_number_id, access_token, payload)
            meta_id = result.get("messages", [{}])[0].get("id")
            message = self.repo.update(
                message.id,
                meta_message_id=meta_id,
                status="SENT",
            )
            self.conv_repo.update(
                request.conversation_id,
                last_message_at=datetime.utcnow(),
            )
            return message
        except Exception as e:
            self.repo.update(message.id, status="FAILED")
            if isinstance(e, HTTPException):
                raise
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"WhatsApp send failed: {str(e)}",
            )

    def send_image_message(
        self,
        request: SendMediaMessageRequest,
        agent_id: int,
        phone_number_id: str,
        access_token: str,
    ) -> WhatsAppInboxMessage:
        conv = self.conv_repo.get_by_id(request.conversation_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")

        image_obj: dict = {}
        if request.media_url:
            image_obj["link"] = request.media_url
        elif request.media_id:
            image_obj["id"] = request.media_id
        if request.caption:
            image_obj["caption"] = request.caption

        payload = {
            "messaging_product": "whatsapp",
            "to": conv.customer_phone,
            "type": "image",
            "image": image_obj,
        }

        result = self._post_to_meta(phone_number_id, access_token, payload)
        meta_id = result.get("messages", [{}])[0].get("id")

        message = self.repo.create(
            conversation_id=request.conversation_id,
            meta_message_id=meta_id,
            sender_type="AGENT",
            sender_id=agent_id,
            message_type="IMAGE",
            caption=request.caption,
            status="SENT",
        )
        self.conv_repo.update(
            request.conversation_id,
            last_message_at=datetime.utcnow(),
        )
        return message

    def send_video_message(
        self,
        request: SendMediaMessageRequest,
        agent_id: int,
        phone_number_id: str,
        access_token: str,
    ) -> WhatsAppInboxMessage:
        conv = self.conv_repo.get_by_id(request.conversation_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")

        video_obj: dict = {}
        if request.media_url:
            video_obj["link"] = request.media_url
        elif request.media_id:
            video_obj["id"] = request.media_id
        if request.caption:
            video_obj["caption"] = request.caption

        payload = {
            "messaging_product": "whatsapp",
            "to": conv.customer_phone,
            "type": "video",
            "video": video_obj,
        }
        result = self._post_to_meta(phone_number_id, access_token, payload)
        meta_id = result.get("messages", [{}])[0].get("id")

        message = self.repo.create(
            conversation_id=request.conversation_id,
            meta_message_id=meta_id,
            sender_type="AGENT",
            sender_id=agent_id,
            message_type="VIDEO",
            caption=request.caption,
            status="SENT",
        )
        self.conv_repo.update(
            request.conversation_id,
            last_message_at=datetime.utcnow(),
        )
        return message

    def send_audio_message(
        self,
        request: SendMediaMessageRequest,
        agent_id: int,
        phone_number_id: str,
        access_token: str,
    ) -> WhatsAppInboxMessage:
        conv = self.conv_repo.get_by_id(request.conversation_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")

        audio_obj: dict = {}
        if request.media_url:
            audio_obj["link"] = request.media_url
        elif request.media_id:
            audio_obj["id"] = request.media_id

        payload = {
            "messaging_product": "whatsapp",
            "to": conv.customer_phone,
            "type": "audio",
            "audio": audio_obj,
        }
        result = self._post_to_meta(phone_number_id, access_token, payload)
        meta_id = result.get("messages", [{}])[0].get("id")

        message = self.repo.create(
            conversation_id=request.conversation_id,
            meta_message_id=meta_id,
            sender_type="AGENT",
            sender_id=agent_id,
            message_type="AUDIO",
            status="SENT",
        )
        self.conv_repo.update(
            request.conversation_id,
            last_message_at=datetime.utcnow(),
        )
        return message

    def send_document_message(
        self,
        request: SendMediaMessageRequest,
        agent_id: int,
        phone_number_id: str,
        access_token: str,
    ) -> WhatsAppInboxMessage:
        conv = self.conv_repo.get_by_id(request.conversation_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")

        doc_obj: dict = {}
        if request.media_url:
            doc_obj["link"] = request.media_url
        elif request.media_id:
            doc_obj["id"] = request.media_id
        if request.caption:
            doc_obj["caption"] = request.caption
        if request.file_name:
            doc_obj["filename"] = request.file_name

        payload = {
            "messaging_product": "whatsapp",
            "to": conv.customer_phone,
            "type": "document",
            "document": doc_obj,
        }
        result = self._post_to_meta(phone_number_id, access_token, payload)
        meta_id = result.get("messages", [{}])[0].get("id")

        message = self.repo.create(
            conversation_id=request.conversation_id,
            meta_message_id=meta_id,
            sender_type="AGENT",
            sender_id=agent_id,
            message_type="DOCUMENT",
            caption=request.caption,
            status="SENT",
        )
        self.conv_repo.update(
            request.conversation_id,
            last_message_at=datetime.utcnow(),
        )
        return message

    def send_template_message(
        self,
        request: SendTemplateMessageRequest,
        agent_id: int,
        phone_number_id: str,
        access_token: str,
    ) -> WhatsAppInboxMessage:
        conv = self.conv_repo.get_by_id(request.conversation_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")

        template_obj: dict = {
            "name": request.template_name,
            "language": {"code": request.language_code},
        }
        if request.components:
            template_obj["components"] = request.components

        payload = {
            "messaging_product": "whatsapp",
            "to": conv.customer_phone,
            "type": "template",
            "template": template_obj,
        }
        result = self._post_to_meta(phone_number_id, access_token, payload)
        meta_id = result.get("messages", [{}])[0].get("id")

        message = self.repo.create(
            conversation_id=request.conversation_id,
            meta_message_id=meta_id,
            sender_type="AGENT",
            sender_id=agent_id,
            message_type="TEMPLATE",
            content=request.template_name,
            status="SENT",
        )
        self.conv_repo.update(
            request.conversation_id,
            last_message_at=datetime.utcnow(),
        )
        return message

    def list_messages(
        self,
        conversation_id: int,
        before_cursor: Optional[datetime] = None,
        page_size: int = 30,
    ) -> MessageListResponse:
        messages, total = self.repo.list_by_conversation(
            conversation_id, before_cursor, page_size
        )
        cursor = None
        if messages:
            cursor = messages[0].created_at.isoformat()

        return MessageListResponse(
            items=[MessageResponse.model_validate(m) for m in messages],
            total=total,
            has_more=len(messages) == page_size,
            cursor=cursor,
        )

    def update_message_status(
        self, meta_message_id: str, new_status: str
    ) -> None:
        self.repo.update_status_by_meta_id(meta_message_id, new_status)

# --- Repository Code ---

class MessageRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, message_id: int) -> Optional[WhatsAppInboxMessage]:
        return (
            self.db.query(WhatsAppInboxMessage)
            .options(
                joinedload(WhatsAppInboxMessage.reactions),
                joinedload(WhatsAppInboxMessage.media_files),
            )
            .filter(WhatsAppInboxMessage.id == message_id)
            .first()
        )

    def get_by_meta_id(self, meta_message_id: str) -> Optional[WhatsAppInboxMessage]:
        return (
            self.db.query(WhatsAppInboxMessage)
            .filter(WhatsAppInboxMessage.meta_message_id == meta_message_id)
            .first()
        )

    def create(self, **kwargs) -> WhatsAppInboxMessage:
        message = WhatsAppInboxMessage(**kwargs)
        self.db.add(message)
        self.db.commit()
        return self.get_by_id(message.id)

    def update(self, message_id: int, **kwargs) -> Optional[WhatsAppInboxMessage]:
        message = self.get_by_id(message_id)
        if message:
            for k, v in kwargs.items():
                setattr(message, k, v)
            self.db.commit()
            self.db.refresh(message)
        return message

    def update_status_by_meta_id(
        self, meta_message_id: str, status: str
    ) -> None:
        message = self.get_by_meta_id(meta_message_id)
        if message:
            message.status = status
            self.db.commit()

    def list_by_conversation(
        self,
        conversation_id: int,
        before_cursor: Optional[datetime] = None,
        page_size: int = 30,
    ) -> tuple[list[WhatsAppInboxMessage], int]:
        query = self.db.query(WhatsAppInboxMessage).filter(
            WhatsAppInboxMessage.conversation_id == conversation_id
        )

        if before_cursor:
            query = query.filter(WhatsAppInboxMessage.created_at < before_cursor)

        total = query.count()

        messages = (
            query.options(
                joinedload(WhatsAppInboxMessage.reactions),
                joinedload(WhatsAppInboxMessage.media_files),
            )
            .order_by(WhatsAppInboxMessage.created_at.desc())
            .limit(page_size)
            .all()
        )

        messages.reverse()
        return messages, total
