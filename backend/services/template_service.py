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
    "name": template_name,
    "category": category.upper(),
    "language": language,
    "components": [
        {
            "type": "BODY",
            "text": body
        }
    ]
}

        response = requests.post(
            url,
            headers=headers,
            json=payload
        )

        print("STATUS CODE:", response.status_code)
        print("RESPONSE:", response.text)

        return response.json()

    def get_template_status(self, meta_template_id):

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