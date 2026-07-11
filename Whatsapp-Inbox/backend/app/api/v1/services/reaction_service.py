from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from collections import defaultdict

from app.api.core.logging import get_logger
from app.db.repositories.reaction_repository import ReactionRepository
from app.db.repositories.message_repository import MessageRepository
from app.api.v1.schemas.reaction import MessageReactionsResponse, ReactionGrouped

logger = get_logger(__name__)


class ReactionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ReactionRepository(db)
        self.msg_repo = MessageRepository(db)

    async def handle_reaction(
        self,
        meta_message_id: str,
        emoji: str,
        customer_phone: str,
    ):
        """Upsert or remove a reaction based on emoji (empty = removal)."""
        msg = await self.msg_repo.get_by_meta_id(meta_message_id)
        if not msg:
            logger.warning(f"Reaction for unknown message: {meta_message_id}")
            return None

        if not emoji:
            # Remove reaction
            await self.repo.delete_by_message_and_customer(msg.id, customer_phone)
            logger.info(f"Reaction removed from message {msg.id} by {customer_phone}")
            return None

        reaction = await self.repo.upsert(msg.id, customer_phone, emoji)
        return reaction

    async def handle_reaction_by_message_id(
        self,
        message_id: UUID,
        emoji: str,
        customer_phone: str,
    ):
        """Upsert or remove a reaction based on a direct message ID."""
        msg = await self.msg_repo.get_by_id(message_id)
        if not msg:
            logger.warning(f"Reaction for unknown message id: {message_id}")
            return None

        if not emoji:
            await self.repo.delete_by_message_and_customer(msg.id, customer_phone)
            logger.info(f"Reaction removed from message {msg.id} by {customer_phone}")
            return None

        reaction = await self.repo.upsert(msg.id, customer_phone, emoji)
        return reaction

    async def get_reactions_for_message(
        self, message_id: UUID
    ) -> MessageReactionsResponse:
        reactions = await self.repo.get_by_message(message_id)
        grouped: dict[str, list[str]] = defaultdict(list)

        for r in reactions:
            grouped[r.emoji].append(r.customer_phone)

        result = [
            ReactionGrouped(emoji=emoji, count=len(phones), customers=phones)
            for emoji, phones in grouped.items()
        ]

        return MessageReactionsResponse(
            message_id=message_id,
            reactions=result,
            total=len(reactions),
        )
