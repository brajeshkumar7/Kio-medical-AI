from collections.abc import Iterator
from dataclasses import dataclass
import re

from backend.extensions import db
from backend.models import Conversation, Message
from backend.repositories.conversations import ConversationRepository


class ConversationNotFoundError(Exception):
    pass


@dataclass(frozen=True)
class ChatResult:
    conversation: Conversation
    user_message: Message
    assistant_message: Message


@dataclass(frozen=True)
class PendingChatStream:
    conversation: Conversation
    user_message: Message
    chunks: Iterator[str]
    metadata: dict


class ConversationMemoryService:
    def __init__(self, repository: ConversationRepository, medical_qa, history_limit: int):
        self.repository = repository
        self.medical_qa = medical_qa
        self.history_limit = history_limit

    def _owner_id(self, actor_id: str, guest: bool) -> str:
        return actor_id if guest else self.repository.get_or_create_user(actor_id).id

    def _get_owned(self, conversation_id: str, owner_id: str, guest: bool, *, lock: bool = False):
        if guest:
            return self.repository.get_guest_owned(conversation_id, owner_id, lock=lock)
        return self.repository.get_owned(conversation_id, owner_id, lock=lock)

    def list_conversations(self, actor_id: str, *, guest: bool = False) -> list[Conversation]:
        owner_id = self._owner_id(actor_id, guest)
        return (
            self.repository.list_for_guest(owner_id)
            if guest else self.repository.list_for_user(owner_id)
        )

    def create_conversation(self, actor_id: str, *, guest: bool = False) -> Conversation:
        owner_id = self._owner_id(actor_id, guest)
        return (
            self.repository.create_for_guest(owner_id)
            if guest else self.repository.create(owner_id)
        )

    def get_conversation(self, actor_id: str, conversation_id: str, *, guest: bool = False) -> Conversation:
        owner_id = self._owner_id(actor_id, guest)
        conversation = self._get_owned(conversation_id, owner_id, guest)
        if conversation is None:
            raise ConversationNotFoundError
        return conversation

    def delete_conversation(self, actor_id: str, conversation_id: str, *, guest: bool = False) -> None:
        conversation = self.get_conversation(actor_id, conversation_id, guest=guest)
        self.repository.delete(conversation)

    def send_message(self, clerk_user_id: str, conversation_id: str, content: str) -> ChatResult:
        user = self.repository.get_or_create_user(clerk_user_id)
        conversation = self.repository.get_owned(conversation_id, user.id, lock=True)
        if conversation is None:
            raise ConversationNotFoundError

        history = [(message.role, message.content) for message in conversation.messages[-self.history_limit :]]
        answer_result = self.medical_qa.answer(content, history)
        if not conversation.messages:
            conversation.title = _conversation_title(content)
        user_message = self.repository.add_message(conversation, "user", content)
        db.session.commit()

        answer = answer_result if isinstance(answer_result, str) else answer_result.content
        metadata = (
            {}
            if isinstance(answer_result, str)
            else _metadata_for_cited_sources(answer, answer_result.metadata)
        )

        conversation = self.repository.get_owned(conversation_id, user.id, lock=True)
        if conversation is None:
            raise ConversationNotFoundError
        assistant_message = self.repository.add_message(
            conversation,
            "assistant",
            answer,
            metadata=metadata,
        )
        db.session.commit()
        return ChatResult(conversation, user_message, assistant_message)

    def start_message_stream(
        self, actor_id: str, conversation_id: str, content: str, *, guest: bool = False
    ) -> PendingChatStream:
        owner_id = self._owner_id(actor_id, guest)
        conversation = self._get_owned(conversation_id, owner_id, guest, lock=True)
        if conversation is None:
            raise ConversationNotFoundError

        history = [(message.role, message.content) for message in conversation.messages[-self.history_limit :]]
        answer_stream = self.medical_qa.stream_answer(content, history)
        if not conversation.messages:
            conversation.title = _conversation_title(content)
        user_message = self.repository.add_message(conversation, "user", content)
        db.session.commit()

        return PendingChatStream(
            conversation=conversation,
            user_message=user_message,
            chunks=answer_stream.chunks,
            metadata=answer_stream.metadata,
        )

    def finish_message_stream(
        self,
        actor_id: str,
        conversation_id: str,
        user_message: Message,
        content: str,
        metadata: dict,
        *,
        guest: bool = False,
    ) -> ChatResult:
        owner_id = self._owner_id(actor_id, guest)
        conversation = self._get_owned(conversation_id, owner_id, guest, lock=True)
        if conversation is None:
            raise ConversationNotFoundError
        assistant_message = self.repository.add_message(
            conversation,
            "assistant",
            content,
            metadata=_metadata_for_cited_sources(content, metadata),
        )
        db.session.commit()
        return ChatResult(conversation, user_message, assistant_message)

    def discard_failed_guest_message(self, guest_id: str, conversation_id: str, message_id: str) -> None:
        conversation = self.repository.get_guest_owned(conversation_id, guest_id, lock=True)
        if conversation is None:
            return
        message = next((item for item in conversation.messages if item.id == message_id), None)
        if message is None or message.role != "user":
            return
        db.session.delete(message)
        if len(conversation.messages) == 1:
            conversation.title = "New conversation"
        db.session.commit()


def _conversation_title(content: str) -> str:
    compact = " ".join(content.split())
    return compact if len(compact) <= 72 else f"{compact[:69].rstrip()}..."


def _metadata_for_cited_sources(content: str, metadata: dict) -> dict:
    sources = metadata.get("sources")
    if not isinstance(sources, list):
        return metadata
    cited_ids = {
        int(square or full_width)
        for square, full_width in re.findall(r"\[(\d+)\]|【(\d+)】", content)
    }
    return {
        **metadata,
        "sources": [
            source
            for source in sources
            if isinstance(source, dict) and source.get("id") in cited_ids
        ],
    }
