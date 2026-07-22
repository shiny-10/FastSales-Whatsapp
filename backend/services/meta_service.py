from __future__ import annotations
import requests
from core.config import settings


class MetaWhatsAppService:
    """
    Thin wrapper around the Meta WhatsApp Cloud API.

    Always constructed with explicit credentials (access_token + phone_number_id)
    sourced from the DB at call-time.  Never reads from .env at construction.
    API version comes from config.META_API_VERSION in one place.
    """

    def __init__(self, access_token: str, phone_number_id: str) -> None:
        self.access_token = access_token
        self.phone_number_id = phone_number_id
        # Single source of truth for the API version
        self.api_version: str = settings.META_API_VERSION
        self._base: str = settings.META_BASE_URL.rstrip("/")

    # ── URL helpers ──────────────────────────────────────────────────────────

    def _url(self, path: str) -> str:
        """Build a versioned Graph API URL.  path should NOT start with '/'."""
        return f"{self._base}/{self.api_version}/{path}"

    @property
    def _messages_url(self) -> str:
        return self._url(f"{self.phone_number_id}/messages")

    @property
    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    # ── Internal POST helper ─────────────────────────────────────────────────

    def _post(self, payload: dict) -> dict:
        import logging
        logger = logging.getLogger(__name__)
        logger.info(
            "[MetaWhatsAppService] POST %s  body=%s",
            self._messages_url,
            {k: v for k, v in payload.items()},
        )
        try:
            response = requests.post(
                self._messages_url,
                headers=self._headers,
                json=payload,
                timeout=10,
            )
            try:
                result = response.json()
            except ValueError:
                result = {"error": response.text}

            if not response.ok:
                return {
                    "success": False,
                    "status_code": response.status_code,
                    "error": result.get("error") or response.text,
                    "response": result,
                }
            return result
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ── Public send methods ──────────────────────────────────────────────────

    def send_template_message(
        self,
        to: str,
        template_name: str,
        language_code: str = "en_US",
    ) -> dict:
        return self._post({
            "messaging_product": "whatsapp",
            "to": to,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language_code},
            },
        })

    def send_text_message(self, to: str, text: str) -> dict:
        return self._post({
            "messaging_product": "whatsapp",
            "to": to,
            "type": "text",
            "text": {"body": text},
        })

    # ── Info / utility ───────────────────────────────────────────────────────

    def get_phone_number_info(self) -> dict:
        """Fetch display_phone_number from the Graph API.
        Uses self.api_version — no more hardcoded v25.0."""
        url = self._url(self.phone_number_id)
        params = {
            "fields": "display_phone_number,verified_name",
            "access_token": self.access_token,
        }
        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"success": False, "error": str(e)}
