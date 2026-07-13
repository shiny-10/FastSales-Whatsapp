from __future__ import annotations
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_
from models.postgres_model import WhatsAppInboxConversation
from typing import Optional
from datetime import datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from services.message_service import MessageRepository
from models.postgres_model import WhatsAppInboxConversation
from schemas.whatsapp_inbox import (
    ConversationListResponse,
    ConversationResponse,
    ConversationFilters,
)

class ConversationService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ConversationRepository(db)
        self.msg_repo = MessageRepository(db)

    def get_or_create(
        self,
        organization_id: int,
        customer_phone: str,
        whatsapp_account_id: Optional[int] = None,
        customer_name: Optional[str] = None,
    ) -> tuple[WhatsAppInboxConversation, bool]:
        """Get existing open conversation or create new one."""
        existing = self.repo.get_by_phone(organization_id, customer_phone)
        if existing:
            return existing, False

        conversation = self.repo.create(
            organization_id=organization_id,
            customer_phone=customer_phone,
            customer_name=customer_name,
            whatsapp_account_id=whatsapp_account_id,
            status="OPEN",
            last_message_at=datetime.utcnow(),
        )
        return conversation, True

    def list_conversations(
        self, organization_id: int, filters: ConversationFilters
    ) -> ConversationListResponse:
        conversations, total = self.repo.list_conversations(
            organization_id=organization_id,
            status=filters.status,
            search=filters.search,
            assigned_agent_id=filters.assigned_agent_id,
            archived=filters.archived,
            page=filters.page,
            page_size=filters.page_size,
        )

        items = []
        for conv in conversations:
            # Get last message preview
            messages, _ = self.msg_repo.list_by_conversation(
                conv.id, page_size=1
            )
            preview = None
            if messages:
                last = messages[-1]
                preview = last.content or f"[{last.message_type}]"

            resp = ConversationResponse(
                id=conv.id,
                organization_id=conv.organization_id,
                customer_phone=conv.customer_phone,
                customer_name=conv.customer_name,
                assigned_agent_id=conv.assigned_agent_id,
                status=conv.status,
                is_archived=conv.is_archived,
                unread_count=conv.unread_count,
                last_message_at=conv.last_message_at,
                created_at=conv.created_at,
                updated_at=conv.updated_at,
                last_message_preview=preview,
            )
            items.append(resp)

        return ConversationListResponse(
            items=items,
            total=total,
            page=filters.page,
            page_size=filters.page_size,
            has_next=(filters.page * filters.page_size) < total,
        )

    def get_conversation(self, conversation_id: int) -> WhatsAppInboxConversation:
        conv = self.repo.get_by_id(conversation_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )
        return conv

    def delete_conversation(self, conversation_id: int) -> None:
        conv = self.repo.get_by_id(conversation_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )
        self.repo.delete(conversation_id)

    def update_conversation(
        self, conversation_id: int, **kwargs
    ) -> WhatsAppInboxConversation:
        conv = self.repo.update(conversation_id, **kwargs)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )
        return conv

    def assign_agent(self, conversation_id: int, agent_id: int) -> WhatsAppInboxConversation:
        return self.update_conversation(
            conversation_id, assigned_agent_id=agent_id
        )

    def reset_unread(self, conversation_id: int) -> WhatsAppInboxConversation:
        conv = self.repo.get_by_id(conversation_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )
        self.repo.reset_unread(conversation_id)
        return self.repo.get_by_id(conversation_id)

    def touch_last_message(self, conversation_id: int, ts: Optional[datetime] = None) -> None:
        ts = ts or datetime.utcnow()
        self.repo.update(conversation_id, last_message_at=ts)

# --- Repository Code ---

class ConversationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, conversation_id: int) -> Optional[WhatsAppInboxConversation]:
        return self.db.query(WhatsAppInboxConversation).filter(WhatsAppInboxConversation.id == conversation_id).first()

    def get_by_phone(
        self, organization_id: int, customer_phone: str
    ) -> Optional[WhatsAppInboxConversation]:
        return (
            self.db.query(WhatsAppInboxConversation)
            .filter(
                WhatsAppInboxConversation.organization_id == organization_id,
                WhatsAppInboxConversation.customer_phone == customer_phone,
                WhatsAppInboxConversation.status.in_(["OPEN", "PENDING"]),
            )
            .first()
        )

    def create(self, **kwargs) -> WhatsAppInboxConversation:
        conversation = WhatsAppInboxConversation(**kwargs)
        self.db.add(conversation)
        self.db.commit()
        self.db.refresh(conversation)
        return conversation

    def update(self, conversation_id: int, **kwargs) -> Optional[WhatsAppInboxConversation]:
        conversation = self.get_by_id(conversation_id)
        if conversation:
            for k, v in kwargs.items():
                setattr(conversation, k, v)
            self.db.commit()
            self.db.refresh(conversation)
        return conversation

    def list_conversations(
        self,
        organization_id: int,
        status: Optional[str] = None,
        search: Optional[str] = None,
        assigned_agent_id: Optional[int] = None,
        archived: Optional[bool] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[WhatsAppInboxConversation], int]:
        query = self.db.query(WhatsAppInboxConversation).filter(
            WhatsAppInboxConversation.organization_id == organization_id
        )

        if status:
            query = query.filter(WhatsAppInboxConversation.status == status)
        if assigned_agent_id:
            query = query.filter(WhatsAppInboxConversation.assigned_agent_id == assigned_agent_id)
        if search:
            query = query.filter(
                or_(
                    WhatsAppInboxConversation.customer_phone.ilike(f"%{search}%"),
                    WhatsAppInboxConversation.customer_name.ilike(f"%{search}%"),
                )
            )

        if archived is None:
            query = query.filter(WhatsAppInboxConversation.is_archived == False)
        else:
            query = query.filter(WhatsAppInboxConversation.is_archived == archived)

        total = query.count()

        conversations = (
            query.order_by(WhatsAppInboxConversation.last_message_at.desc().nullslast())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )

        return conversations, total

    def increment_unread(self, conversation_id: int) -> None:
        conversation = self.get_by_id(conversation_id)
        if conversation:
            conversation.unread_count += 1
            self.db.commit()

    def reset_unread(self, conversation_id: int) -> None:
        conversation = self.get_by_id(conversation_id)
        if conversation:
            conversation.unread_count = 0
            self.db.commit()

    def delete(self, conversation_id: int) -> None:
        conversation = self.get_by_id(conversation_id)
        if conversation:
            self.db.delete(conversation)
            self.db.commit()
