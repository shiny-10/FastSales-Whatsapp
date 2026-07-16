from __future__ import annotations
from typing import Optional
import httpx
import boto3
from botocore.exceptions import ClientError
from sqlalchemy.orm import Session

from core.config import settings
from core.config import settings as config
from models.postgres_model import WhatsAppInboxMediaFile

class MediaService:
    def __init__(self, db: Session):
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

    def get_meta_media_url(self, media_id: str, access_token: str) -> str:
        """Fetch download URL from Meta API."""
        meta_base_url = getattr(config, "META_BASE_URL", "https://graph.facebook.com")
        meta_api_version = getattr(config, "META_API_VERSION", "v23.0")
        url = f"{meta_base_url}/{meta_api_version}/{media_id}"
        headers = {"Authorization": f"Bearer {access_token}"}
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data["url"]

    def download_meta_media(self, download_url: str, access_token: str) -> tuple[bytes, str]:
        """Download media bytes from Meta CDN."""
        headers = {"Authorization": f"Bearer {access_token}"}
        with httpx.Client(timeout=60.0) as client:
            resp = client.get(download_url, headers=headers)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "application/octet-stream")
            return resp.content, content_type

    def upload_to_s3(self, data: bytes, s3_key: str, mime_type: str) -> str:
        """Upload bytes to S3, return public/signed URL."""
        try:
            self.s3.put_object(
                Bucket=settings.AWS_BUCKET_NAME,
                Key=s3_key,
                Body=data,
                ContentType=mime_type,
            )
            region = settings.AWS_REGION
            bucket = settings.AWS_BUCKET_NAME
            public_url = f"https://{bucket}.s3.{region}.amazonaws.com/{s3_key}"
            return public_url
        except ClientError as e:
            raise e

    def generate_signed_url(self, s3_key: str) -> str:
        try:
            expiry = int(settings.AWS_SIGNED_URL_EXPIRY) if settings.AWS_SIGNED_URL_EXPIRY else 3600
        except ValueError:
            expiry = 3600
        return self.s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.AWS_BUCKET_NAME, "Key": s3_key},
            ExpiresIn=expiry,
        )

    def process_incoming_media(
        self,
        message_id: int,
        media_id: str,
        access_token: str,
        mime_type: Optional[str] = None,
        file_name: Optional[str] = None,
    ) -> WhatsAppInboxMediaFile:
        """Full pipeline: Meta -> S3 -> DB record."""
        download_url = self.get_meta_media_url(media_id, access_token)

        data, detected_mime = self.download_meta_media(
            download_url, access_token
        )
        final_mime = mime_type or detected_mime

        ext = self._mime_to_ext(final_mime)
        s3_key = f"media/{message_id}/{media_id}{ext}"

        public_url = self.upload_to_s3(data, s3_key, final_mime)

        media = WhatsAppInboxMediaFile(
            message_id=message_id,
            media_id=media_id,
            file_name=file_name or f"{media_id}{ext}",
            file_url=public_url,
            s3_key=s3_key,
            mime_type=final_mime,
            file_size=len(data),
        )
        self.db.add(media)
        self.db.commit()
        self.db.refresh(media)
        return media

    def get_signed_url_for_media(self, media: WhatsAppInboxMediaFile) -> str:
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

# --- Repository Code ---

class MediaFileRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, media_file_id: int) -> Optional[WhatsAppInboxMediaFile]:
        return self.db.query(WhatsAppInboxMediaFile).filter(WhatsAppInboxMediaFile.id == media_file_id).first()

    def create(self, **kwargs) -> WhatsAppInboxMediaFile:
        obj = WhatsAppInboxMediaFile(**kwargs)
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj
