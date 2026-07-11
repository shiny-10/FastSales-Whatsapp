import requests


class MetaWhatsAppService:

    def __init__(
        self,
        access_token: str,
        phone_number_id: str
    ):
        self.access_token = access_token
        self.phone_number_id = phone_number_id

        self.base_url = (
            f"https://graph.facebook.com/v25.0/"
            f"{phone_number_id}/messages"
        )

    def send_template_message(
        self,
        to: str,
        template_name: str
    ):

        headers = {
            "Authorization": (
                f"Bearer {self.access_token}"
            ),
            "Content-Type": "application/json"
        }

        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {
                    "code": "en_US"
                }
            }
        }

        try:
            response = requests.post(
                self.base_url,
                headers=headers,
                json=payload,
                timeout=10
            )
            print("STATUS:", response.status_code)
            print("RESPONSE:", response.text)
            return response.json()
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def send_text_message(
        self,
        to: str,
        text: str
    ):
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "text",
            "text": {
                "body": text
            }
        }
        try:
            response = requests.post(
                self.base_url,
                headers=headers,
                json=payload,
                timeout=10
            )
            print("STATUS:", response.status_code)
            print("RESPONSE:", response.text)
            return response.json()
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def get_phone_number_info(self):
        url = f"https://graph.facebook.com/v25.0/{self.phone_number_id}"
        params = {
            "fields": "display_phone_number",
            "access_token": self.access_token,
        }

        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
            }
