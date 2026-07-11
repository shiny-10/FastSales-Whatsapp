from uuid import UUID
from typing import Optional
from datetime import datetime, timezone
import httpx
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.core.config import settings
from app.api.core.logging import get_logger
from app.db.session import AsyncSessionLocal
from app.db.repositories.message_repository import MessageRepository
from app.db.repositories.conversation_repository import ConversationRepository
from app.db.repositories.whatsapp_repository import WhatsAppRepository
from app.db.models import Message, SenderType, MessageType, MessageStatus
from app.api.v1.schemas.message import (
    SendTextMessageRequest,
    SendMediaMessageRequest,
    SendTemplateMessageRequest,
    MessageListResponse,
    MessageResponse,
)
from app.api.v1.services.media_service import MediaService

logger = get_logger(__name__)


class MessageService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = MessageRepository(db)
        self.conv_repo = ConversationRepository(db)
        self.media_svc = MediaService(db)

    def _meta_url(self, phone_number_id: str) -> str:
        return (
            f"{settings.META_BASE_URL}/{settings.META_API_VERSION}"
            f"/{phone_number_id}/messages"
        )

    async def _post_to_meta(
        self, phone_number_id: str, access_token: str, payload: dict
    ) -> dict:
        url = self._meta_url(phone_number_id)
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        logger.info("WhatsApp Meta send request: %s %s", url, payload)
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                resp = await client.post(url, json=payload, headers=headers)
                text = resp.text
                logger.info(
                    "WhatsApp Meta response status=%s body=%s",
                    resp.status_code,
                    text,
                )
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPStatusError as e:
                status_code = e.response.status_code if e.response is not None else None
                text = e.response.text if e.response is not None else str(e)
                logger.error(
                    "Meta send message failed: status=%s body=%s",
                    status_code,
                    text,
                )

                if status_code == 401 and e.response is not None:
                    try:
                        error_json = e.response.json()
                        error_data = error_json.get("error", {})
                        if error_data.get("code") == 190:
                            logger.warning(
                                "WhatsApp access token invalid or expired for phone_number_id=%s",
                                phone_number_id,
                            )
                            await self._deactivate_invalid_account(phone_number_id)
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
                # Network-level errors (DNS, connection reset, timeouts, etc.)
                logger.error("Meta send message request failed: %s", str(e))
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Meta request error: {str(e)}",
                )

    async def _deactivate_invalid_account(self, phone_number_id: str) -> None:
        """Persistently deactivate a WhatsApp account when its token is invalid."""
        try:
            async with AsyncSessionLocal() as session:
                wa_repo = WhatsAppRepository(session)
                account = await wa_repo.get_by_phone_number_id(phone_number_id)
                if account:
                    await wa_repo.update(account.id, status="DISCONNECTED")
                    await session.commit()
                    logger.warning(
                        "Deactivated WhatsApp account %s due to invalid credentials",
                        account.id,
                    )
        except Exception as e:
            logger.error(
                "Failed to deactivate invalid WhatsApp account for phone_number_id=%s: %s",
                phone_number_id,
                e,
            )

    async def send_text_message(
        self,
        request: SendTextMessageRequest,
        agent_id: UUID,
        phone_number_id: str,
        access_token: str,
    ) -> Message:
        conv = await self.conv_repo.get_by_id(request.conversation_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")

        message = await self.repo.create(
            conversation_id=request.conversation_id,
            meta_message_id=None,
            sender_type=SenderType.AGENT,
            sender_id=agent_id,
            message_type=MessageType.TEXT,
            content=request.content,
            status=MessageStatus.PENDING,
            reply_to_message_id=request.reply_to_message_id,
        )

        payload = {
            "messaging_product": "whatsapp",
            "to": conv.customer_phone,
            "type": "text",
            "text": {"body": request.content, "preview_url": False},
        }

        if request.reply_to_message_id:
            orig = await self.repo.get_by_id(request.reply_to_message_id)
            if orig and orig.meta_message_id:
                payload["context"] = {"message_id": orig.meta_message_id}

        try:
            result = await self._post_to_meta(phone_number_id, access_token, payload)
            meta_id = result.get("messages", [{}])[0].get("id")
            message = await self.repo.update(
                message.id,
                meta_message_id=meta_id,
                status=MessageStatus.SENT,
            )
            await self.conv_repo.update(
                request.conversation_id,
                last_message_at=datetime.now(timezone.utc),
            )
            return message
        except HTTPException:
            await self.repo.update(message.id, status=MessageStatus.FAILED)
            raise
        except Exception as e:
            logger.exception("Text message send failed")
            await self.repo.update(message.id, status=MessageStatus.FAILED)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"WhatsApp send failed: {str(e)}",
            )

    async def send_image_message(
        self,
        request: SendMediaMessageRequest,
        agent_id: UUID,
        phone_number_id: str,
        access_token: str,
    ) -> Message:
        conv = await self.conv_repo.get_by_id(request.conversation_id)
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

        result = await self._post_to_meta(phone_number_id, access_token, payload)
        meta_id = result.get("messages", [{}])[0].get("id")

        message = await self.repo.create(
            conversation_id=request.conversation_id,
            meta_message_id=meta_id,
            sender_type=SenderType.AGENT,
            sender_id=agent_id,
            message_type=MessageType.IMAGE,
            caption=request.caption,
            status=MessageStatus.SENT,
        )
        await self.conv_repo.update(
            request.conversation_id,
            last_message_at=datetime.now(timezone.utc),
        )
        return message

    async def send_video_message(
        self,
        request: SendMediaMessageRequest,
        agent_id: UUID,
        phone_number_id: str,
        access_token: str,
    ) -> Message:
        conv = await self.conv_repo.get_by_id(request.conversation_id)
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
        result = await self._post_to_meta(phone_number_id, access_token, payload)
        meta_id = result.get("messages", [{}])[0].get("id")

        message = await self.repo.create(
            conversation_id=request.conversation_id,
            meta_message_id=meta_id,
            sender_type=SenderType.AGENT,
            sender_id=agent_id,
            message_type=MessageType.VIDEO,
            caption=request.caption,
            status=MessageStatus.SENT,
        )
        await self.conv_repo.update(
            request.conversation_id,
            last_message_at=datetime.now(timezone.utc),
        )
        return message

    async def send_audio_message(
        self,
        request: SendMediaMessageRequest,
        agent_id: UUID,
        phone_number_id: str,
        access_token: str,
    ) -> Message:
        conv = await self.conv_repo.get_by_id(request.conversation_id)
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
        result = await self._post_to_meta(phone_number_id, access_token, payload)
        meta_id = result.get("messages", [{}])[0].get("id")

        message = await self.repo.create(
            conversation_id=request.conversation_id,
            meta_message_id=meta_id,
            sender_type=SenderType.AGENT,
            sender_id=agent_id,
            message_type=MessageType.AUDIO,
            status=MessageStatus.SENT,
        )
        await self.conv_repo.update(
            request.conversation_id,
            last_message_at=datetime.now(timezone.utc),
        )
        return message

    async def send_document_message(
        self,
        request: SendMediaMessageRequest,
        agent_id: UUID,
        phone_number_id: str,
        access_token: str,
    ) -> Message:
        conv = await self.conv_repo.get_by_id(request.conversation_id)
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
        result = await self._post_to_meta(phone_number_id, access_token, payload)
        meta_id = result.get("messages", [{}])[0].get("id")

        message = await self.repo.create(
            conversation_id=request.conversation_id,
            meta_message_id=meta_id,
            sender_type=SenderType.AGENT,
            sender_id=agent_id,
            message_type=MessageType.DOCUMENT,
            caption=request.caption,
            status=MessageStatus.SENT,
        )
        await self.conv_repo.update(
            request.conversation_id,
            last_message_at=datetime.now(timezone.utc),
        )
        return message

    async def send_template_message(
        self,
        request: SendTemplateMessageRequest,
        agent_id: UUID,
        phone_number_id: str,
        access_token: str,
    ) -> Message:
        conv = await self.conv_repo.get_by_id(request.conversation_id)
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
        result = await self._post_to_meta(phone_number_id, access_token, payload)
        meta_id = result.get("messages", [{}])[0].get("id")

        message = await self.repo.create(
            conversation_id=request.conversation_id,
            meta_message_id=meta_id,
            sender_type=SenderType.AGENT,
            sender_id=agent_id,
            message_type=MessageType.TEMPLATE,
            content=request.template_name,
            status=MessageStatus.SENT,
        )
        await self.conv_repo.update(
            request.conversation_id,
            last_message_at=datetime.now(timezone.utc),
        )
        return message

    async def list_messages(
        self,
        conversation_id: UUID,
        before_cursor: Optional[datetime] = None,
        page_size: int = 30,
    ) -> MessageListResponse:
        messages, total = await self.repo.list_by_conversation(
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

    async def update_message_status(
        self, meta_message_id: str, new_status: MessageStatus
    ) -> None:
        await self.repo.update_status_by_meta_id(meta_message_id, new_status)
