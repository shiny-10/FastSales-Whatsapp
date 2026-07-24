from __future__ import annotations
from typing import Optional
import httpx
from sqlalchemy.orm import Session

from core.config import settings
from core.config import settings as config
from models.postgres_model import WhatsAppInboxMediaFile

class MediaService:
    def __init__(self, db: Session):
        self.db = db

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

    def process_incoming_media(
        self,
        message_id: int,
        media_id: str,
        access_token: str,
        mime_type: Optional[str] = None,
        file_name: Optional[str] = None,
    ) -> WhatsAppInboxMediaFile:
        """Create a local media record using Meta's temporary CDN URL."""
        download_url = self.get_meta_media_url(media_id, access_token)
        final_fname = file_name or f"{media_id}"

        media = WhatsAppInboxMediaFile(
            message_id=message_id,
            media_id=media_id,
            file_name=final_fname,
            file_url=download_url,
            mime_type=mime_type,
            file_size=None,
        )
        self.db.add(media)
        self.db.commit()
        self.db.refresh(media)
        return media

    def get_signed_url_for_media(self, media: WhatsAppInboxMediaFile) -> str:
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
