from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.v1.endpoints.dependencies.security import require_agent
from app.api.v1.services.broadcast_service import BroadcastService
from app.api.v1.services.messaging_features_service import (
    AutoReplyService, ChatbotRuleService, CannedResponseService, ScheduledMessageService,
)
from app.api.v1.endpoints.messages import _get_wa_credentials
from app.api.v1.schemas.messaging_features import (
    BroadcastCreate, BroadcastUpdate, BroadcastResponse,
    AutoReplyCreate, AutoReplyUpdate, AutoReplyResponse,
    ChatbotRuleCreate, ChatbotRuleUpdate, ChatbotRuleResponse,
    CannedResponseCreate, CannedResponseUpdate, CannedResponseResponse,
    ScheduledMessageCreate, ScheduledMessageResponse,
)

router = APIRouter(tags=["Messaging Features"])


# ── Broadcasts ─────────────────────────────────────────────────────────────────

@router.get("/broadcasts", response_model=list[BroadcastResponse])
async def list_broadcasts(db: AsyncSession = Depends(get_db), user: dict = Depends(require_agent)):
    svc = BroadcastService(db)
    return await svc.list(UUID(user["company_id"]))


@router.post("/broadcasts", response_model=BroadcastResponse)
async def create_broadcast(
    body: BroadcastCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    svc = BroadcastService(db)
    broadcast = await svc.create(UUID(user["company_id"]), **body.model_dump())
    await db.commit()
    return broadcast


@router.patch("/broadcasts/{broadcast_id}", response_model=BroadcastResponse)
async def update_broadcast(
    broadcast_id: UUID,
    body: BroadcastUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    svc = BroadcastService(db)
    updated = await svc.update(broadcast_id, **body.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    await db.commit()
    return updated


@router.delete("/broadcasts/{broadcast_id}", status_code=204)
async def delete_broadcast(
    broadcast_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    svc = BroadcastService(db)
    await svc.delete(broadcast_id)
    await db.commit()


@router.post("/broadcasts/{broadcast_id}/send", response_model=BroadcastResponse)
async def send_broadcast(
    broadcast_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    company_id = UUID(user["company_id"])
    svc = BroadcastService(db)
    broadcast = await svc.get(broadcast_id)
    if not broadcast:
        raise HTTPException(status_code=404, detail="Broadcast not found")

    phone_number_id, access_token = await _get_wa_credentials(company_id, db)
    result = await svc.send_now(broadcast, phone_number_id, access_token)
    await db.commit()
    return result


# ── Scheduled Messages ─────────────────────────────────────────────────────────

@router.get("/scheduled-messages", response_model=list[ScheduledMessageResponse])
async def list_scheduled(db: AsyncSession = Depends(get_db), user: dict = Depends(require_agent)):
    svc = ScheduledMessageService(db)
    return await svc.list(UUID(user["company_id"]))


@router.post("/scheduled-messages", response_model=ScheduledMessageResponse)
async def create_scheduled(
    body: ScheduledMessageCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    svc = ScheduledMessageService(db)
    obj = await svc.create(
        UUID(user["company_id"]),
        agent_id=UUID(user["sub"]),
        **body.model_dump(),
    )
    await db.commit()
    return obj


@router.delete("/scheduled-messages/{msg_id}", response_model=ScheduledMessageResponse)
async def cancel_scheduled(
    msg_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    svc = ScheduledMessageService(db)
    obj = await svc.cancel(msg_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Scheduled message not found")
    await db.commit()
    return obj


# ── Auto Replies ───────────────────────────────────────────────────────────────

@router.get("/auto-replies", response_model=list[AutoReplyResponse])
async def list_auto_replies(db: AsyncSession = Depends(get_db), user: dict = Depends(require_agent)):
    svc = AutoReplyService(db)
    return await svc.list(UUID(user["company_id"]))


@router.post("/auto-replies", response_model=AutoReplyResponse)
async def create_auto_reply(
    body: AutoReplyCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    svc = AutoReplyService(db)
    obj = await svc.create(UUID(user["company_id"]), **body.model_dump())
    await db.commit()
    return obj


@router.patch("/auto-replies/{reply_id}", response_model=AutoReplyResponse)
async def update_auto_reply(
    reply_id: UUID,
    body: AutoReplyUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    svc = AutoReplyService(db)
    obj = await svc.update(reply_id, **body.model_dump(exclude_none=True))
    if not obj:
        raise HTTPException(status_code=404, detail="Auto reply not found")
    await db.commit()
    return obj


@router.delete("/auto-replies/{reply_id}", status_code=204)
async def delete_auto_reply(
    reply_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    svc = AutoReplyService(db)
    await svc.delete(reply_id)
    await db.commit()


# ── Chatbot Rules ──────────────────────────────────────────────────────────────

@router.get("/chatbot-rules", response_model=list[ChatbotRuleResponse])
async def list_chatbot_rules(db: AsyncSession = Depends(get_db), user: dict = Depends(require_agent)):
    svc = ChatbotRuleService(db)
    return await svc.list(UUID(user["company_id"]))


@router.post("/chatbot-rules", response_model=ChatbotRuleResponse)
async def create_chatbot_rule(
    body: ChatbotRuleCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    svc = ChatbotRuleService(db)
    obj = await svc.create(UUID(user["company_id"]), **body.model_dump())
    await db.commit()
    return obj


@router.patch("/chatbot-rules/{rule_id}", response_model=ChatbotRuleResponse)
async def update_chatbot_rule(
    rule_id: UUID,
    body: ChatbotRuleUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    svc = ChatbotRuleService(db)
    obj = await svc.update(rule_id, **body.model_dump(exclude_none=True))
    if not obj:
        raise HTTPException(status_code=404, detail="Rule not found")
    await db.commit()
    return obj


@router.delete("/chatbot-rules/{rule_id}", status_code=204)
async def delete_chatbot_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    svc = ChatbotRuleService(db)
    await svc.delete(rule_id)
    await db.commit()


# ── Canned Responses ───────────────────────────────────────────────────────────

@router.get("/canned-responses", response_model=list[CannedResponseResponse])
async def list_canned(
    q: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    svc = CannedResponseService(db)
    if q:
        return await svc.search(UUID(user["company_id"]), q)
    return await svc.list(UUID(user["company_id"]))


@router.post("/canned-responses", response_model=CannedResponseResponse)
async def create_canned(
    body: CannedResponseCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    svc = CannedResponseService(db)
    obj = await svc.create(UUID(user["company_id"]), **body.model_dump())
    await db.commit()
    return obj


@router.patch("/canned-responses/{canned_id}", response_model=CannedResponseResponse)
async def update_canned(
    canned_id: UUID,
    body: CannedResponseUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    svc = CannedResponseService(db)
    obj = await svc.update(canned_id, **body.model_dump(exclude_none=True))
    if not obj:
        raise HTTPException(status_code=404, detail="Canned response not found")
    await db.commit()
    return obj


@router.delete("/canned-responses/{canned_id}", status_code=204)
async def delete_canned(
    canned_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    svc = CannedResponseService(db)
    await svc.delete(canned_id)
    await db.commit()
