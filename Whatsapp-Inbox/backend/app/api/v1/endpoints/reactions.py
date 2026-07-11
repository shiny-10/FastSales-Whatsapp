from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.v1.endpoints.dependencies.security import require_agent
from app.api.v1.services.reaction_service import ReactionService
from app.api.v1.schemas.reaction import MessageReactionsResponse, ReactionResponse
from app.api.v1.services.socket_service import emit_new_reaction

router = APIRouter(tags=["Reactions"])


@router.get(
    "/messages/{message_id}/reactions",
    response_model=MessageReactionsResponse,
)
async def get_message_reactions(
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    """Get all reactions for a specific message."""
    svc = ReactionService(db)
    return await svc.get_reactions_for_message(message_id)


@router.post(
    "/messages/{message_id}/reactions",
    response_model=ReactionResponse,
)
async def create_or_update_reaction(
    message_id: UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_agent),
):
    """Create, update, or remove a reaction for a message."""
    emoji = (payload or {}).get("emoji", "")
    if not emoji:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="emoji is required")

    svc = ReactionService(db)
    reaction = await svc.handle_reaction_by_message_id(
        message_id,
        emoji,
        str(user.get("sub") or user.get("email") or user.get("phone_number") or "agent"),
    )
    if not reaction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    message = await svc.msg_repo.get_by_id(reaction.message_id)
    conversation_id = str(message.conversation_id) if message else str(reaction.message_id)

    await emit_new_reaction(
        str(user["company_id"]),
        conversation_id,
        ReactionResponse.model_validate(reaction),
    )
    return ReactionResponse.model_validate(reaction)
