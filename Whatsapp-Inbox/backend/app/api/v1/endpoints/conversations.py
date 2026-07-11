from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.v1.endpoints.dependencies.security import get_current_user, require_agent
from app.api.v1.services.conversation_service import ConversationService
from app.api.v1.services.socket_service import emit_agent_assigned
from app.api.v1.schemas.conversation import (
    ConversationListResponse,
    ConversationResponse,
    ConversationCreateRequest,
    ConversationUpdateRequest,
    AssignAgentRequest,
    ConversationFilters,
)
from app.db.models import ConversationStatus

router = APIRouter(prefix="/conversations", tags=["Conversations"])


@router.post("", response_model=ConversationResponse)
async def create_conversation(
    request: ConversationCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    company_id = UUID(user["company_id"])
    svc = ConversationService(db)
    conversation, _ = await svc.get_or_create(
        company_id=company_id,
        customer_phone=request.customer_phone,
        customer_name=request.customer_name,
    )
    return ConversationResponse.model_validate(conversation)


@router.get("", response_model=ConversationListResponse)
async def list_conversations(
    status: Optional[ConversationStatus] = Query(None),
    search: Optional[str] = Query(None),
    assigned_agent_id: Optional[UUID] = Query(None),
    archived: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    company_id = UUID(user["company_id"])
    svc = ConversationService(db)
    filters = ConversationFilters(
        status=status,
        search=search,
        assigned_agent_id=assigned_agent_id,
        archived=archived,
        page=page,
        page_size=page_size,
    )
    return await svc.list_conversations(company_id, filters)


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    svc = ConversationService(db)
    conv = await svc.get_conversation(conversation_id)
    return ConversationResponse.model_validate(conv)


@router.post("/{conversation_id}/assign", response_model=ConversationResponse)
async def assign_agent(
    conversation_id: UUID,
    request: AssignAgentRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    company_id = user["company_id"]
    svc = ConversationService(db)
    conv = await svc.assign_agent(conversation_id, request.agent_id)
    # Emit realtime event
    await emit_agent_assigned(
        str(company_id), str(conversation_id), str(request.agent_id)
    )
    return ConversationResponse.model_validate(conv)


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: UUID,
    request: ConversationUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    svc = ConversationService(db)
    update_data = request.model_dump(exclude_none=True)
    conv = await svc.update_conversation(conversation_id, **update_data)
    return ConversationResponse.model_validate(conv)


@router.post("/{conversation_id}/read", response_model=ConversationResponse)
async def mark_conversation_read(
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    svc = ConversationService(db)
    conv = await svc.reset_unread(conversation_id)
    return ConversationResponse.model_validate(conv)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    svc = ConversationService(db)
    await svc.delete_conversation(conversation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
