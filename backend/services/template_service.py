from __future__ import annotations
from core.config import settings
import requests

# Map human-readable language names / common codes → Meta-accepted locale codes
# Full list: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/supported-languages
_LANGUAGE_MAP: dict[str, str] = {
    # English variants
    "english": "en_US",
    "english (us)": "en_US",
    "english (uk)": "en_GB",
    "en": "en_US",
    "en_us": "en_US",
    "en_gb": "en_GB",
    # Arabic
    "arabic": "ar",
    "ar": "ar",
    # Spanish
    "spanish": "es_ES",
    "spanish (spain)": "es_ES",
    "spanish (mexico)": "es_MX",
    "es": "es_ES",
    "es_es": "es_ES",
    "es_mx": "es_MX",
    # Portuguese
    "portuguese": "pt_BR",
    "portuguese (brazil)": "pt_BR",
    "portuguese (portugal)": "pt_PT",
    "pt": "pt_BR",
    "pt_br": "pt_BR",
    "pt_pt": "pt_PT",
    # French
    "french": "fr",
    "fr": "fr",
    # German
    "german": "de",
    "de": "de",
    # Italian
    "italian": "it",
    "it": "it",
    # Dutch
    "dutch": "nl",
    "nl": "nl",
    # Turkish
    "turkish": "tr",
    "tr": "tr",
    # Russian
    "russian": "ru",
    "ru": "ru",
    # Indonesian
    "indonesian": "id",
    "id": "id",
    # Hindi
    "hindi": "hi",
    "hi": "hi",
    # Malay
    "malay": "ms",
    "ms": "ms",
    # Chinese
    "chinese (simplified)": "zh_CN",
    "chinese (traditional)": "zh_TW",
    "chinese": "zh_CN",
    "zh": "zh_CN",
    "zh_cn": "zh_CN",
    "zh_tw": "zh_TW",
    # Japanese
    "japanese": "ja",
    "ja": "ja",
    # Korean
    "korean": "ko",
    "ko": "ko",
    # Polish
    "polish": "pl",
    "pl": "pl",
    # Ukrainian
    "ukrainian": "uk",
    "uk": "uk",
    # Greek
    "greek": "el",
    "el": "el",
    # Hebrew
    "hebrew": "he",
    "he": "he",
    # Thai
    "thai": "th",
    "th": "th",
    # Bengali
    "bengali": "bn",
    "bn": "bn",
    # Tamil
    "tamil": "ta",
    "ta": "ta",
    # Swahili
    "swahili": "sw",
    "sw": "sw",
    # Afrikaans
    "afrikaans": "af",
    "af": "af",
    # Catalan
    "catalan": "ca",
    "ca": "ca",
    # Czech
    "czech": "cs",
    "cs": "cs",
    # Danish
    "danish": "da",
    "da": "da",
    # Finnish
    "finnish": "fi",
    "fi": "fi",
    # Hungarian
    "hungarian": "hu",
    "hu": "hu",
    # Norwegian
    "norwegian": "nb",
    "nb": "nb",
    "no": "nb",
    # Romanian
    "romanian": "ro",
    "ro": "ro",
    # Slovak
    "slovak": "sk",
    "sk": "sk",
    # Swedish
    "swedish": "sv",
    "sv": "sv",
    # Vietnamese
    "vietnamese": "vi",
    "vi": "vi",
    # Filipino
    "filipino": "fil",
    "fil": "fil",
    # Urdu
    "urdu": "ur",
    "ur": "ur",
    # Persian / Farsi
    "persian": "fa",
    "farsi": "fa",
    "fa": "fa",
}


def normalize_language(lang: str) -> str:
    """
    Normalize a language value to a Meta-accepted locale code.
    Handles: human-readable names, short codes, hyphenated locales (en-US → en_US).
    Returns 'en_US' as fallback if nothing matches.
    """
    if not lang:
        return "en_US"
    # Normalise separators and whitespace before map lookup
    cleaned = lang.strip().lower().replace("-", "_")
    normalized = _LANGUAGE_MAP.get(cleaned)
    return normalized if normalized else cleaned


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

        # Normalize language to a Meta-accepted locale code
        meta_language = normalize_language(language or "en_US")

        payload = {
            # Meta requires snake_case lowercase names
            "name": template_name.lower().replace(" ", "_").replace("-", "_"),
            "category": (category or "MARKETING").upper(),
            "language": meta_language,   # plain string e.g. "en_US" — NOT {"code": "en_US"}
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