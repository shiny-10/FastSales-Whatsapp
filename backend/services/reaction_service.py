from __future__ import annotations
from typing import Optional
from collections import defaultdict
from sqlalchemy.orm import Session

from services.message_service import MessageRepository
from schemas.whatsapp_inbox import MessageReactionsResponse, ReactionGrouped
from models.postgres_model import WhatsAppInboxMessageReaction

class ReactionService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ReactionRepository(db)
        self.msg_repo = MessageRepository(db)

    def handle_reaction(
        self,
        meta_message_id: str,
        emoji: str,
        customer_phone: str,
    ) -> Optional[WhatsAppInboxMessageReaction]:
        """Upsert or remove a reaction based on emoji (empty = removal)."""
        msg = self.msg_repo.get_by_meta_id(meta_message_id)
        if not msg:
            return None

        if not emoji:
            self.repo.delete_by_message_and_customer(msg.id, customer_phone)
            return None

        reaction = self.repo.upsert(msg.id, customer_phone, emoji)
        return reaction

    def handle_reaction_by_message_id(
        self,
        message_id: int,
        emoji: str,
        customer_phone: str,
    ) -> Optional[WhatsAppInboxMessageReaction]:
        """Upsert or remove a reaction based on a direct message ID."""
        msg = self.msg_repo.get_by_id(message_id)
        if not msg:
            return None

        if not emoji:
            self.repo.delete_by_message_and_customer(msg.id, customer_phone)
            return None

        reaction = self.repo.upsert(msg.id, customer_phone, emoji)
        return reaction

    def get_reactions_for_message(
        self, message_id: int
    ) -> MessageReactionsResponse:
        reactions = self.repo.get_by_message(message_id)
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

# --- Repository Code ---

class ReactionRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_message_and_customer(
        self, message_id: int, customer_phone: str
    ) -> Optional[WhatsAppInboxMessageReaction]:
        return (
            self.db.query(WhatsAppInboxMessageReaction)
            .filter(
                WhatsAppInboxMessageReaction.message_id == message_id,
                WhatsAppInboxMessageReaction.customer_phone == customer_phone,
            )
            .first()
        )

    def get_by_message(self, message_id: int) -> list[WhatsAppInboxMessageReaction]:
        return (
            self.db.query(WhatsAppInboxMessageReaction)
            .filter(WhatsAppInboxMessageReaction.message_id == message_id)
            .all()
        )

    def create(self, **kwargs) -> WhatsAppInboxMessageReaction:
        reaction = WhatsAppInboxMessageReaction(**kwargs)
        self.db.add(reaction)
        self.db.commit()
        self.db.refresh(reaction)
        return reaction

    def upsert(
        self, message_id: int, customer_phone: str, emoji: str
    ) -> WhatsAppInboxMessageReaction:
        existing = self.get_by_message_and_customer(message_id, customer_phone)
        if existing:
            existing.emoji = emoji
            self.db.commit()
            self.db.refresh(existing)
            return existing
        return self.create(
            message_id=message_id,
            customer_phone=customer_phone,
            emoji=emoji,
        )

    def delete_by_message_and_customer(
        self, message_id: int, customer_phone: str
    ) -> None:
        reaction = self.get_by_message_and_customer(message_id, customer_phone)
        if reaction:
            self.db.delete(reaction)
            self.db.commit()
