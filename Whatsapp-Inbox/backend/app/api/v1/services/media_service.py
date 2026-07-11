import uuid
import io
from typing import Optional
import httpx
import boto3
from botocore.exceptions import ClientError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.core.config import settings
from app.api.core.logging import get_logger
from app.db.models import MediaFile

logger = get_logger(__name__)


class MediaService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self._s3_client = None

    @property
    def s3(self):
        if self._s3_client is None:
            self._s3_client = boto3.client(
                "s3",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION,
            )
        return self._s3_client

    async def get_meta_media_url(
        self, media_id: str, access_token: str
    ) -> str:
        """Fetch download URL from Meta API."""
        url = f"{settings.META_BASE_URL}/{settings.META_API_VERSION}/{media_id}"
        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data["url"]

    async def download_meta_media(
        self, download_url: str, access_token: str
    ) -> tuple[bytes, str]:
        """Download media bytes from Meta CDN."""
        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(download_url, headers=headers)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "application/octet-stream")
            return resp.content, content_type

    def upload_to_s3(
        self,
        data: bytes,
        s3_key: str,
        mime_type: str,
    ) -> str:
        """Upload bytes to S3, return public/signed URL."""
        try:
            self.s3.put_object(
                Bucket=settings.AWS_BUCKET_NAME,
                Key=s3_key,
                Body=data,
                ContentType=mime_type,
            )
            logger.info(f"Uploaded media to S3: {s3_key}")
            # Build a public S3 URL fallback so frontend can open documents directly
            region = settings.AWS_REGION
            bucket = settings.AWS_BUCKET_NAME
            public_url = f"https://{bucket}.s3.{region}.amazonaws.com/{s3_key}"
            return public_url
        except ClientError as e:
            logger.error(f"S3 upload failed: {e}")
            raise

    def generate_signed_url(self, s3_key: str) -> str:
        return self.s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.AWS_BUCKET_NAME, "Key": s3_key},
            ExpiresIn=settings.AWS_SIGNED_URL_EXPIRY,
        )

    async def process_incoming_media(
        self,
        message_id: uuid.UUID,
        media_id: str,
        access_token: str,
        mime_type: Optional[str] = None,
        file_name: Optional[str] = None,
    ) -> MediaFile:
        """Full pipeline: Meta → S3 → DB record."""
        try:
            # 1. Get download URL
            download_url = await self.get_meta_media_url(media_id, access_token)

            # 2. Download
            data, detected_mime = await self.download_meta_media(
                download_url, access_token
            )
            final_mime = mime_type or detected_mime

            # 3. Build S3 key
            ext = self._mime_to_ext(final_mime)
            s3_key = f"media/{message_id}/{media_id}{ext}"

            # 4. Upload -> returns a public URL when possible
            public_url = self.upload_to_s3(data, s3_key, final_mime)

            # 5. Save to DB (store both s3_key and a usable file_url)
            media = MediaFile(
                message_id=message_id,
                media_id=media_id,
                file_name=file_name or f"{media_id}{ext}",
                file_url=public_url,
                s3_key=s3_key,
                mime_type=final_mime,
                file_size=len(data),
            )
            self.db.add(media)
            await self.db.flush()
            await self.db.refresh(media)
            return media

        except Exception as e:
            logger.error(f"Media processing failed for media_id={media_id}: {e}")
            raise

    def get_signed_url_for_media(self, media: MediaFile) -> str:
        if media.s3_key:
            return self.generate_signed_url(media.s3_key)
        return media.file_url or ""

    @staticmethod
    def _mime_to_ext(mime: str) -> str:
        mapping = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "video/mp4": ".mp4",
            "video/3gpp": ".3gp",
            "audio/mpeg": ".mp3",
            "audio/ogg": ".ogg",
            "audio/opus": ".opus",
            "application/pdf": ".pdf",
            "application/vnd.ms-excel": ".xls",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
            "application/msword": ".doc",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
        }
        return mapping.get(mime, "")
