from __future__ import annotations
from core.config import settings
import re
import requests
from sqlalchemy import func
from sqlalchemy.orm import Session
from models.postgres_model import Template

_LANGUAGE_MAP: dict[str, str] = {
    "english": "en_US",
    "english (us)": "en_US",
    "english (uk)": "en_GB",
    "en": "en_US",
    "en_us": "en_US",
    "en_gb": "en_GB",
    "arabic": "ar",
    "ar": "ar",
    "spanish": "es_ES",
    "spanish (spain)": "es_ES",
    "spanish (mexico)": "es_MX",
    "es": "es_ES",
    "es_es": "es_ES",
    "es_mx": "es_MX",
    "portuguese": "pt_BR",
    "portuguese (brazil)": "pt_BR",
    "portuguese (portugal)": "pt_PT",
    "pt": "pt_BR",
    "pt_br": "pt_BR",
    "pt_pt": "pt_PT",
    "french": "fr",
    "fr": "fr",
    "german": "de",
    "de": "de",
    "italian": "it",
    "it": "it",
    "dutch": "nl",
    "nl": "nl",
    "turkish": "tr",
    "tr": "tr",
    "russian": "ru",
    "ru": "ru",
    "indonesian": "id",
    "id": "id",
    "hindi": "hi",
    "hi": "hi",
    "malay": "ms",
    "ms": "ms",
    "chinese (simplified)": "zh_CN",
    "chinese (traditional)": "zh_TW",
    "chinese": "zh_CN",
    "zh": "zh_CN",
    "zh_cn": "zh_CN",
    "zh_tw": "zh_TW",
    "japanese": "ja",
    "ja": "ja",
    "korean": "ko",
    "ko": "ko",
    "polish": "pl",
    "pl": "pl",
    "ukrainian": "uk",
    "uk": "uk",
    "greek": "el",
    "el": "el",
    "hebrew": "he",
    "he": "he",
    "thai": "th",
    "th": "th",
    "bengali": "bn",
    "bn": "bn",
    "tamil": "ta",
    "ta": "ta",
    "swahili": "sw",
    "sw": "sw",
    "afrikaans": "af",
    "af": "af",
    "catalan": "ca",
    "ca": "ca",
    "czech": "cs",
    "cs": "cs",
    "danish": "da",
    "da": "da",
    "finnish": "fi",
    "fi": "fi",
    "hungarian": "hu",
    "hu": "hu",
    "norwegian": "nb",
    "nb": "nb",
    "no": "nb",
    "romanian": "ro",
    "ro": "ro",
    "slovak": "sk",
    "sk": "sk",
    "swedish": "sv",
    "sv": "sv",
    "vietnamese": "vi",
    "vi": "vi",
    "filipino": "fil",
    "fil": "fil",
    "urdu": "ur",
    "ur": "ur",
    "persian": "fa",
    "farsi": "fa",
    "fa": "fa",
}


def normalize_language(lang: str) -> str:
    if not lang:
        return "en_US"
    cleaned = lang.strip().lower().replace("-", "_")
    normalized = _LANGUAGE_MAP.get(cleaned)
    return normalized if normalized else cleaned


def normalize_name(name: str) -> str:
    if not name:
        return ""
    return name.strip().lower().replace(" ", "_").replace("-", "_")


def sync_all_templates_from_meta(db: Session) -> dict:
    from services.whatsapp_service import WhatsAppService
    account = WhatsAppService(db).get_account()
    if not account or not account.access_token or not account.waba_id:
        return {"success": False, "synced": 0, "message": "No active WhatsApp account configured."}

    waba_id = account.waba_id
    access_token = account.access_token
    meta_base = getattr(settings, "META_BASE_URL", "https://graph.facebook.com").rstrip('/')
    version = getattr(settings, "META_API_VERSION", "v23.0")

    url = f"{meta_base}/{version}/{waba_id}/message_templates?limit=250"
    headers = {"Authorization": f"Bearer {access_token}"}

    try:
        resp = requests.get(url, headers=headers, timeout=20)
        data = resp.json()
    except Exception as e:
        return {"success": False, "synced": 0, "message": f"Error contacting Meta: {e}"}

    if "error" in data:
        err_msg = data["error"].get("message") or str(data["error"])
        return {"success": False, "synced": 0, "message": f"Meta API error: {err_msg}"}

    templates_list = data.get("data", [])
    synced_count = 0

    for t in templates_list:
        meta_id = str(t.get("id"))
        raw_name = t.get("name", "")
        category = t.get("category", "MARKETING")
        language = t.get("language", "en_US")
        status_str = t.get("status", "APPROVED")

        components = t.get("components", [])
        body_text = ""
        header_text = None
        footer_text = None
        buttons_list = []

        for comp in components:
            ctype = comp.get("type", "").upper()
            if ctype == "BODY":
                body_text = comp.get("text", "")
            elif ctype == "HEADER":
                header_text = comp.get("text") or comp.get("format", "text")
            elif ctype == "FOOTER":
                footer_text = comp.get("text")
            elif ctype == "BUTTONS":
                buttons_list = comp.get("buttons", [])

        sanitized_raw_name = normalize_name(raw_name)
        existing = db.query(Template).filter(
            (Template.meta_template_id == meta_id) |
            (func.lower(Template.template_name) == func.lower(raw_name)) |
            (func.replace(func.replace(func.lower(Template.template_name), ' ', '_'), '-', '_') == sanitized_raw_name)
        ).first()

        if existing:
            existing.meta_template_id = meta_id
            existing.meta_template_name = raw_name
            existing.meta_status = status_str
            existing.category = category
            existing.language = language
            if body_text:
                existing.template_body = body_text
            if header_text:
                existing.header = header_text
            if footer_text:
                existing.footer = footer_text
            if buttons_list:
                existing.buttons = buttons_list
        else:
            new_tmpl = Template(
                template_name=raw_name,
                category=category,
                language=language,
                header=header_text or "none",
                template_body=body_text or f"[{raw_name}]",
                footer=footer_text,
                buttons=buttons_list,
                meta_template_id=meta_id,
                meta_template_name=raw_name,
                meta_status=status_str,
                status="active"
            )
            db.add(new_tmpl)

        synced_count += 1

    db.commit()
    return {
        "success": True,
        "synced": synced_count,
        "message": f"Successfully synced {synced_count} templates from Meta.",
    }


class MetaTemplateService:

    def create_template(
        self,
        template_name,
        category,
        language,
        body,
        db: Session = None,
    ):
        base = settings.META_BASE_URL.rstrip('/')
        version = settings.META_API_VERSION

        token = None
        waba = None
        if db:
            from services.whatsapp_service import WhatsAppService
            account = WhatsAppService(db).get_account()
            if account:
                token = account.access_token
                waba = account.waba_id

        token = token or settings.META_ACCESS_TOKEN or settings.ACCESS_TOKEN
        waba = waba or settings.META_BUSINESS_ACCOUNT_ID or settings.WABA_ID

        url = f"{base}/{version}/{waba}/message_templates"

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        meta_language = normalize_language(language or "en_US")

        payload = {
            "name": template_name.lower().replace(" ", "_").replace("-", "_"),
            "category": (category or "MARKETING").upper(),
            "language": meta_language,
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

    def get_template_status_by_name(self, template_name: str, db: Session = None) -> dict:
        base = settings.META_BASE_URL.rstrip('/')
        version = settings.META_API_VERSION

        token = None
        waba = None
        if db:
            from services.whatsapp_service import WhatsAppService
            account = WhatsAppService(db).get_account()
            if account:
                token = account.access_token
                waba = account.waba_id

        token = token or settings.META_ACCESS_TOKEN or settings.ACCESS_TOKEN
        waba = waba or settings.META_BUSINESS_ACCOUNT_ID or settings.WABA_ID

        if not token or not waba:
            return {"error": "WhatsApp account is not connected. Go to Settings → Configuration."}

        sanitized = template_name.lower().replace(" ", "_").replace("-", "_")

        url = (
            f"{base}/{version}/{waba}/message_templates"
            f"?name={sanitized}&fields=id,name,status,category,language"
        )

        headers = {"Authorization": f"Bearer {token}"}

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
            return {"error": f"No template named '{sanitized}' found on Meta", "not_found": True}

        first = data[0]
        return {
            "id": first.get("id"),
            "name": first.get("name"),
            "status": first.get("status"),
            "category": first.get("category"),
            "language": first.get("language"),
        }

    def get_template_status(self, meta_template_id: str, db: Session = None) -> dict:
        base = settings.META_BASE_URL.rstrip('/')
        version = settings.META_API_VERSION

        token = None
        if db:
            from services.whatsapp_service import WhatsAppService
            account = WhatsAppService(db).get_account()
            if account:
                token = account.access_token

        token = token or settings.META_ACCESS_TOKEN or settings.ACCESS_TOKEN

        url = f"{base}/{version}/{meta_template_id}?fields=name,status,category"

        headers = {
            "Authorization": f"Bearer {token}"
        }

        response = requests.get(url, headers=headers, timeout=10)

        try:
            return response.json()
        except Exception:
            return {"error": "invalid_json_response", "status_code": response.status_code, "text": response.text}