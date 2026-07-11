from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.v1.endpoints.dependencies.security import get_current_user, require_manager
from app.api.v1.services.whatsapp_service import WhatsAppService
from app.api.v1.schemas.whatsapp import (
    WhatsAppConnectRequest,
    WhatsAppAccountResponse,
    WhatsAppStatusResponse,
)

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp Configuration"])


@router.post("/connect", response_model=WhatsAppAccountResponse)
async def connect_whatsapp(
    request: WhatsAppConnectRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_manager),
):
    """Connect / update a WhatsApp Business Account for the current company."""
    company_id = UUID(user["company_id"])
    svc = WhatsAppService(db)
    account = await svc.connect(company_id, request)
    return account


@router.get("/account", response_model=WhatsAppStatusResponse)
async def get_whatsapp_account(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Get the WhatsApp account for the current company."""
    company_id = UUID(user["company_id"])
    svc = WhatsAppService(db)
    account = await svc.get_account(company_id)
    if account is None:
        return WhatsAppStatusResponse(
            connected=False,
            account=None,
            message="No WhatsApp account connected",
        )
    connected = account.status == "ACTIVE"
    return WhatsAppStatusResponse(
        connected=connected,
        account=WhatsAppAccountResponse.model_validate(account),
        message="Account connected" if connected else account.status,
    )


@router.delete("/disconnect", status_code=status.HTTP_200_OK)
async def disconnect_whatsapp(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_manager),
):
    """Disconnect (deactivate) the WhatsApp account."""
    company_id = UUID(user["company_id"])
    svc = WhatsAppService(db)
    await svc.disconnect(company_id)
    return {"message": "WhatsApp account disconnected successfully"}
