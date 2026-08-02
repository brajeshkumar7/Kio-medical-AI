from sqlalchemy import select

from backend.extensions import db
from backend.models import Conversation, Message, User, utc_now


class ConversationRepository:
    def get_or_create_user(self, clerk_user_id: str) -> User:
        user = db.session.scalar(select(User).where(User.clerk_user_id == clerk_user_id))
        if user is None:
            user = User(clerk_user_id=clerk_user_id)
            db.session.add(user)
            db.session.commit()
        return user

    def list_for_user(self, user_id: str, limit: int = 50) -> list[Conversation]:
        statement = (
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .order_by(Conversation.updated_at.desc())
            .limit(limit)
        )
        return list(db.session.scalars(statement))

    def get_owned(self, conversation_id: str, user_id: str, *, lock: bool = False) -> Conversation | None:
        statement = select(Conversation).where(
            Conversation.id == conversation_id, Conversation.user_id == user_id
        )
        if lock:
            statement = statement.with_for_update()
        return db.session.scalar(statement)

    def create(self, user_id: str, title: str = "New conversation") -> Conversation:
        conversation = Conversation(user_id=user_id, title=title)
        db.session.add(conversation)
        db.session.commit()
        return conversation

    def add_message(
        self,
        conversation: Conversation,
        role: str,
        content: str,
        metadata: dict | None = None,
    ) -> Message:
        next_sequence = (conversation.messages[-1].sequence + 1) if conversation.messages else 1
        message = Message(
            conversation=conversation,
            role=role,
            content=content,
            sequence=next_sequence,
            message_metadata=metadata or {},
        )
        conversation.updated_at = utc_now()
        db.session.add(message)
        return message

    def delete(self, conversation: Conversation) -> None:
        db.session.delete(conversation)
        db.session.commit()
