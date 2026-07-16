from __future__ import annotations
from core.config import settings
import requests

class MetaTemplateService:

    def create_template(
        self,
        template_name,
        category,
        language,
        body
    ):

        base = settings.META_BASE_URL.rstrip('/')
        version = settings.META_API_VERSION
        waba = settings.META_BUSINESS_ACCOUNT_ID or settings.WABA_ID

        url = f"{base}/{version}/{waba}/message_templates"

        headers = {
            "Authorization": f"Bearer {settings.META_ACCESS_TOKEN}",
            "Content-Type": "application/json"
        }

        payload = {
            # Meta requires snake_case lowercase names
            "name": template_name.lower().replace(" ", "_").replace("-", "_"),
            "category": (category or "MARKETING").upper(),
            "language": {"code": language},
            "components": [
                {
                    "type": "BODY",
                    "text": body,
                }
            ],
        }

        response = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=30,
        )

        print("STATUS CODE:", response.status_code)
        print("RESPONSE:", response.text)

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

        return {
            "success": True,
            "id": result.get("id") or result.get("template_id"),
            "status": result.get("status"),
            "response": result,
        }

    def get_template_status_by_name(self, template_name: str) -> dict:
        """
        Fetch template status from Meta by name.
        Uses WABA's message_templates list filtered by name — more reliable
        than looking up by ID because the name is always known.
        """
        base = settings.META_BASE_URL.rstrip('/')
        version = settings.META_API_VERSION
        waba = settings.META_BUSINESS_ACCOUNT_ID or settings.WABA_ID

        # Sanitize name the same way we do on creation
        sanitized = template_name.lower().replace(" ", "_").replace("-", "_")

        url = (
            f"{base}/{version}/{waba}/message_templates"
            f"?name={sanitized}&fields=id,name,status,category,language"
        )

        headers = {"Authorization": f"Bearer {settings.META_ACCESS_TOKEN}"}

        try:
            response = requests.get(url, headers=headers, timeout=10)
            result = response.json()
        except Exception as e:
            return {"error": str(e)}

        if not response.ok:
            err = result.get("error", {})
            return {
                "error": err.get("message") or err.get("error_user_msg") or response.text,
                "status_code": response.status_code,
            }

        data = result.get("data", [])
        if not data:
            return {"error": f"No template named '{sanitized}' found on Meta"}

        # There may be multiple entries (one per language) — pick the first
        first = data[0]
        return {
            "id": first.get("id"),
            "name": first.get("name"),
            "status": first.get("status"),
            "category": first.get("category"),
            "language": first.get("language"),
        }

    def get_template_status(self, meta_template_id: str) -> dict:
        """Legacy: look up by Meta template object ID."""

        base = settings.META_BASE_URL.rstrip('/')
        version = settings.META_API_VERSION

        url = f"{base}/{version}/{meta_template_id}?fields=name,status,category"

        headers = {
            "Authorization": f"Bearer {settings.META_ACCESS_TOKEN}"
        }

        response = requests.get(url, headers=headers, timeout=10)

        try:
            return response.json()
        except Exception:
            return {"error": "invalid_json_response", "status_code": response.status_code, "text": response.text}