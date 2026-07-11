"""
Direct media upload endpoint.
Accepts multipart/form-data, uploads to S3, sends via Meta API, stores message.
"""
import uuid
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.v1.endpoints.dependencies.security import require_agent
from app.api.core.logging import get_logger
from app.api.v1.services.whatsapp_service import WhatsAppService
from app.api.v1.services.media_service import MediaService
from app.api.v1.services.message_service import MessageService
from app.api.v1.services.socket_service import emit_new_message
from app.db.repositories.conversation_repository import ConversationRepository
from app.db.models import Message, SenderType, MessageType, MessageStatus, MediaFile
from app.api.v1.schemas.message import MessageResponse

logger = get_logger(__name__)
router = APIRouter(tags=["Upload"])

# Max 25 MB (Meta limit)
MAX_FILE_SIZE = 25 * 1024 * 1024

MIME_TO_MESSAGE_TYPE = {
    "image/": MessageType.IMAGE,
    "video/": MessageType.VIDEO,
    "audio/": MessageType.AUDIO,
}


def _detect_message_type(mime: str, declared: str) -> MessageType:
    declared_upper = declared.upper()
    if declared_upper in [e.value for e in MessageType]:
        return MessageType(declared_upper)
    for prefix, msg_type in MIME_TO_MESSAGE_TYPE.items():
        if mime.startswith(prefix):
            return msg_type
    return MessageType.DOCUMENT


@router.post("/messages/send/media-upload", response_model=MessageResponse)
async def upload_and_send_media(
    file: UploadFile = File(...),
    conversation_id: str = Form(...),
    message_type: str = Form("DOCUMENT"),
    caption: str = Form(""),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    """Upload a local file → S3 → send via Meta API → store message."""
    company_id = uuid.UUID(user["company_id"])
    agent_id = uuid.UUID(user["sub"])

    # Size check
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {MAX_FILE_SIZE // (1024*1024)} MB",
        )

    # Get WA account
    wa_svc = WhatsAppService(db)
    account = await wa_svc.get_account(company_id)
    if not account or account.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active WhatsApp account",
        )

    # Get conversation
    conv_repo = ConversationRepository(db)
    conv_id = uuid.UUID(conversation_id)
    conv = await conv_repo.get_by_id(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Upload to S3
    media_svc = MediaService(db)
    mime = file.content_type or "application/octet-stream"
    msg_type = _detect_message_type(mime, message_type)
    ext = media_svc._mime_to_ext(mime)
    s3_key = f"uploads/{conv_id}/{uuid.uuid4()}{ext}"

    try:
        media_svc.upload_to_s3(content, s3_key, mime)
        s3_url = media_svc.generate_signed_url(s3_key)
    except Exception as e:
        logger.error(f"S3 upload failed: {e}")
        raise HTTPException(status_code=500, detail="Media upload failed")

    # Send via Meta (using hosted link)
    from app.api.v1.schemas.message import SendMediaMessageRequest
    send_req = SendMediaMessageRequest(
        conversation_id=conv_id,
        message_type=msg_type,
        media_url=s3_url,
        caption=caption or None,
        file_name=file.filename,
    )

    msg_svc = MessageService(db)
    if msg_type == MessageType.IMAGE:
        message = await msg_svc.send_image_message(send_req, agent_id, account.phone_number_id, account.access_token)
    elif msg_type == MessageType.VIDEO:
        message = await msg_svc.send_video_message(send_req, agent_id, account.phone_number_id, account.access_token)
    elif msg_type == MessageType.AUDIO:
        message = await msg_svc.send_audio_message(send_req, agent_id, account.phone_number_id, account.access_token)
    else:
        message = await msg_svc.send_document_message(send_req, agent_id, account.phone_number_id, account.access_token)

    # Attach media file record
    media_record = MediaFile(
        message_id=message.id,
        file_name=file.filename,
        file_url=s3_url,
        s3_key=s3_key,
        mime_type=mime,
        file_size=len(content),
    )
    db.add(media_record)
    await db.flush()

    # Reload with relations
    from app.db.repositories.message_repository import MessageRepository
    msg_repo = MessageRepository(db)
    full_message = await msg_repo.get_by_id(message.id)

    await emit_new_message(
        str(company_id), str(conv_id),
        MessageResponse.model_validate(full_message),
    )

    return MessageResponse.model_validate(full_message)
