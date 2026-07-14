from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.database import SessionLocal
from services.whatsapp_service import WhatsAppService

router = APIRouter(prefix="/inbox/whatsapp", tags=["Inbox WhatsApp"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/connect", response_model=dict)
def connect(payload: dict, db: Session = Depends(get_db)):
    organization_id = payload.get("organization_id")
    waba_id = payload.get("waba_id")
    phone_number_id = payload.get("phone_number_id")
    access_token = payload.get("access_token")
    if not organization_id or not waba_id or not phone_number_id or not access_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="organization_id, waba_id, phone_number_id and access_token are required")
    svc = WhatsAppService(db)
    account = svc.connect(organization_id, waba_id, phone_number_id, access_token)
    return {"id": account.id, "status": account.status, "waba_id": account.waba_id, "phone_number_id": account.phone_number_id}
