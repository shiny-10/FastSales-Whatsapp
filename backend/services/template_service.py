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

        url = f"https://graph.facebook.com/v25.0/{settings.WABA_ID}/message_templates"

        headers = {
            "Authorization": f"Bearer {settings.ACCESS_TOKEN}",
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

        url = (
            f"https://graph.facebook.com/v25.0/"
            f"{meta_template_id}"
            "?fields=name,status,category"
        )

        headers = {
            "Authorization": f"Bearer {settings.ACCESS_TOKEN}"
        }

        response = requests.get(
            url,
            headers=headers
        )

        return response.json()