from __future__ import annotations
from typing import Optional
from datetime import datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, update

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
        from services.message_service import MessageRepository
        self.msg_repo = MessageRepository(db)

    def get_or_create(
        self,
        customer_phone: str,
        whatsapp_account_id: Optional[int] = None,
        customer_name: Optional[str] = None,
        organization_id: Optional[int] = None,
    ) -> tuple[WhatsAppInboxConversation, bool]:
        """Get existing open conversation or create new one."""
        existing = self.repo.get_by_phone(customer_phone)
        if existing:
            return existing, False

        conversation = self.repo.create(
            customer_phone=customer_phone,
            customer_name=customer_name,
            whatsapp_account_id=whatsapp_account_id,
            status="OPEN",
            last_message_at=datetime.utcnow(),
        )
        return conversation, True

    def record_outgoing_inbox_message(
        self,
        customer_phone: str,
        content: str,
        message_type: str = "TEMPLATE",
        meta_message_id: Optional[str] = None,
        customer_name: Optional[str] = None,
        whatsapp_account_id: Optional[int] = None,
    ):
        from models.postgres_model import WhatsAppInboxMessage
        from services import socket_service
        from schemas.whatsapp_inbox import MessageResponse

        clean_phone = customer_phone.replace("+", "").replace(" ", "").replace("-", "").strip()
        inbox_conv, _ = self.get_or_create(
            customer_phone=clean_phone,
            customer_name=customer_name,
            whatsapp_account_id=whatsapp_account_id,
        )

        inbox_msg = WhatsAppInboxMessage(
            conversation_id=inbox_conv.id,
            meta_message_id=meta_message_id,
            sender_type="AGENT",
            message_type=message_type,
            content=content,
            status="SENT" if meta_message_id else "FAILED",
        )
        self.db.add(inbox_msg)

        inbox_conv.last_message_at = datetime.utcnow()
        inbox_conv.status = "OPEN"
        self.db.commit()
        self.db.refresh(inbox_msg)

        try:
            socket_svc.emit_new_message(inbox_conv.id, MessageResponse.model_validate(inbox_msg))
        except Exception as e:
            print(f"[record_outgoing_inbox_message] WebSocket broadcast warning: {e}")

        return inbox_msg

    def list_conversations(
        self, filters: ConversationFilters, organization_id: Optional[int] = None
    ) -> ConversationListResponse:
        conversations, total = self.repo.list_conversations(
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
        self, customer_phone: str, organization_id: Optional[int] = None
    ) -> Optional[WhatsAppInboxConversation]:
        if not customer_phone:
            return None
        clean_phone = customer_phone.replace("+", "").replace(" ", "").replace("-", "").strip()
        last_10 = clean_phone[-10:] if len(clean_phone) >= 10 else clean_phone

        exact = (
            self.db.query(WhatsAppInboxConversation)
            .filter(
                or_(
                    WhatsAppInboxConversation.customer_phone == clean_phone,
                    WhatsAppInboxConversation.customer_phone == f"+{clean_phone}",
                    WhatsAppInboxConversation.customer_phone == customer_phone,
                )
            )
            .first()
        )
        if exact:
            return exact

        all_convs = self.db.query(WhatsAppInboxConversation).all()
        for conv in all_convs:
            c_clean = (conv.customer_phone or "").replace("+", "").replace(" ", "").replace("-", "").strip()
            c_last_10 = c_clean[-10:] if len(c_clean) >= 10 else c_clean
            if last_10 and (last_10 == c_last_10 or c_clean.endswith(clean_phone) or clean_phone.endswith(c_clean)):
                return conv

        return None

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
        status: Optional[str] = None,
        search: Optional[str] = None,
        assigned_agent_id: Optional[int] = None,
        archived: Optional[bool] = None,
        page: int = 1,
        page_size: int = 20,
        organization_id: Optional[int] = None,
    ) -> tuple[list[WhatsAppInboxConversation], int]:
        query = self.db.query(WhatsAppInboxConversation)

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
        self.db.execute(
            update(WhatsAppInboxConversation)
            .where(WhatsAppInboxConversation.id == conversation_id)
            .values(unread_count=WhatsAppInboxConversation.unread_count + 1)
        )
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
