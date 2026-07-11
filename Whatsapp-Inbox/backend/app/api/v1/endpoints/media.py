"""Media proxy endpoints — generate signed S3 URLs for frontend access."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.db.session import get_db
from app.api.v1.endpoints.dependencies.security import require_agent
from app.api.v1.services.media_service import MediaService
from app.db.repositories.message_repository import MessageRepository

router = APIRouter(prefix="/media", tags=["Media"])


class SignedUrlResponse(BaseModel):
    signed_url: str
    expires_in: int


@router.get("/{media_file_id}/signed-url", response_model=SignedUrlResponse)
async def get_signed_url(
    media_file_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    """Generate a short-lived signed S3 URL for a media file."""
    from app.db.models import MediaFile
    from sqlalchemy import select

    result = await db.execute(
        select(MediaFile).where(MediaFile.id == media_file_id)
    )
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")

    svc = MediaService(db)
    from app.api.core.config import settings

    try:
        signed_url = svc.generate_signed_url(media.s3_key or "")
    except Exception:
        # If S3 signing failed, try to return a usable public URL.
        # If media.file_url is already a full URL, use it. If it's a stored s3 key,
        # build a public S3 URL using configured bucket/region as a best-effort fallback.
        if media.file_url and (media.file_url.startswith("http://") or media.file_url.startswith("https://")):
            signed_url = media.file_url
        elif media.file_url:
            region = settings.AWS_REGION
            bucket = settings.AWS_BUCKET_NAME
            signed_url = f"https://{bucket}.s3.{region}.amazonaws.com/{media.file_url}"
        else:
            signed_url = ""
    return SignedUrlResponse(
        signed_url=signed_url,
        expires_in=settings.AWS_SIGNED_URL_EXPIRY,
    )
