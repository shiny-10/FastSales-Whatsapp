from uuid import UUID
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.core.config import settings
from app.api.core.logging import get_logger
from app.db.session import get_db
from app.api.v1.endpoints.dependencies.security import get_current_user, require_agent
from app.api.v1.services.message_service import MessageService
from app.api.v1.services.whatsapp_service import WhatsAppService
from app.api.v1.services.socket_service import emit_new_message
from app.api.v1.schemas.message import (
    SendTextMessageRequest,
    SendMediaMessageRequest,
    SendTemplateMessageRequest,
    SendMessageRequest,
    MessageListResponse,
    MessageResponse,
    MessageUpdateRequest,
)
from app.db.models import MessageType

router = APIRouter(tags=["Messages"])
logger = get_logger(__name__)


async def _get_wa_credentials(
    company_id: UUID, db: AsyncSession
) -> tuple[str, str]:
    """Helper to fetch phone_number_id and access_token for a company."""
    wa_svc = WhatsAppService(db)
    account = await wa_svc.get_account(company_id)
    if account is not None:
        if account.status == "ACTIVE":
            return account.phone_number_id, account.access_token

        if settings.META_ACCESS_TOKEN and settings.META_WHATSAPP_PHONE_NUMBER_ID:
            logger.warning(
                "WhatsApp account %s is not active; falling back to env credentials",
                account.id,
            )
            return settings.META_WHATSAPP_PHONE_NUMBER_ID, settings.META_ACCESS_TOKEN

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Your WhatsApp account is disconnected or has invalid credentials. "
                "Please reconnect in settings."
            ),
        )

    if settings.META_ACCESS_TOKEN and settings.META_WHATSAPP_PHONE_NUMBER_ID:
        logger.warning(
            "No WhatsApp account configured for company %s; falling back to env credentials",
            company_id,
        )
        return settings.META_WHATSAPP_PHONE_NUMBER_ID, settings.META_ACCESS_TOKEN

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No active WhatsApp account connected",
    )


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=MessageListResponse,
    tags=["Conversations"],
)
async def list_messages(
    conversation_id: UUID,
    before: Optional[datetime] = Query(None, description="Cursor for pagination (ISO timestamp)"),
    page_size: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    svc = MessageService(db)
    return await svc.list_messages(conversation_id, before_cursor=before, page_size=page_size)


@router.post("/messages/send", response_model=MessageResponse)
async def send_message(
    request: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    company_id = UUID(user["company_id"])
    agent_id = UUID(user["sub"])
    phone_number_id, access_token = await _get_wa_credentials(company_id, db)

    svc = MessageService(db)
    if request.message_type == MessageType.TEXT:
        message = await svc.send_text_message(request, agent_id, phone_number_id, access_token)
    elif request.message_type == MessageType.TEMPLATE:
        message = await svc.send_template_message(request, agent_id, phone_number_id, access_token)
    elif request.message_type == MessageType.IMAGE:
        message = await svc.send_image_message(request, agent_id, phone_number_id, access_token)
    elif request.message_type == MessageType.VIDEO:
        message = await svc.send_video_message(request, agent_id, phone_number_id, access_token)
    elif request.message_type == MessageType.AUDIO:
        message = await svc.send_audio_message(request, agent_id, phone_number_id, access_token)
    elif request.message_type == MessageType.DOCUMENT:
        message = await svc.send_document_message(request, agent_id, phone_number_id, access_token)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported message type: {request.message_type}",
        )

    await emit_new_message(
        str(company_id), str(request.conversation_id),
        MessageResponse.model_validate(message),
    )
    return MessageResponse.model_validate(message)


@router.post("/messages/send/text", response_model=MessageResponse)
async def send_text(
    request: SendTextMessageRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    company_id = UUID(user["company_id"])
    agent_id = UUID(user["sub"])
    phone_number_id, access_token = await _get_wa_credentials(company_id, db)

    svc = MessageService(db)
    message = await svc.send_text_message(request, agent_id, phone_number_id, access_token)
    await emit_new_message(
        str(company_id),
        str(request.conversation_id),
        MessageResponse.model_validate(message),
    )
    return MessageResponse.model_validate(message)


@router.post("/messages/send/media", response_model=MessageResponse)
async def send_media(
    request: SendMediaMessageRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    company_id = UUID(user["company_id"])
    agent_id = UUID(user["sub"])
    phone_number_id, access_token = await _get_wa_credentials(company_id, db)

    svc = MessageService(db)
    message_type = request.message_type

    if message_type == MessageType.IMAGE:
        message = await svc.send_image_message(request, agent_id, phone_number_id, access_token)
    elif message_type == MessageType.VIDEO:
        message = await svc.send_video_message(request, agent_id, phone_number_id, access_token)
    elif message_type == MessageType.AUDIO:
        message = await svc.send_audio_message(request, agent_id, phone_number_id, access_token)
    elif message_type == MessageType.DOCUMENT:
        message = await svc.send_document_message(request, agent_id, phone_number_id, access_token)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported media type: {message_type}",
        )

    await emit_new_message(
        str(company_id), str(request.conversation_id),
        MessageResponse.model_validate(message),
    )
    return MessageResponse.model_validate(message)


@router.post("/messages/send/template", response_model=MessageResponse)
async def send_template(
    request: SendTemplateMessageRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    company_id = UUID(user["company_id"])
    agent_id = UUID(user["sub"])
    phone_number_id, access_token = await _get_wa_credentials(company_id, db)

    svc = MessageService(db)
    message = await svc.send_template_message(request, agent_id, phone_number_id, access_token)

    await emit_new_message(
        str(company_id), str(request.conversation_id),
        MessageResponse.model_validate(message),
    )
    return MessageResponse.model_validate(message)


@router.patch("/messages/{message_id}", response_model=MessageResponse)
async def update_message(
    message_id: UUID,
    request: MessageUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    from app.db.repositories.message_repository import MessageRepository
    repo = MessageRepository(db)
    update_data = request.model_dump(exclude_none=True)
    message = await repo.update(message_id, **update_data)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    return MessageResponse.model_validate(message)
