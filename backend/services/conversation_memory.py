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

    def list_conversations(self, clerk_user_id: str) -> list[Conversation]:
        user = self.repository.get_or_create_user(clerk_user_id)
        return self.repository.list_for_user(user.id)

    def create_conversation(self, clerk_user_id: str) -> Conversation:
        user = self.repository.get_or_create_user(clerk_user_id)
        return self.repository.create(user.id)

    def get_conversation(self, clerk_user_id: str, conversation_id: str) -> Conversation:
        user = self.repository.get_or_create_user(clerk_user_id)
        conversation = self.repository.get_owned(conversation_id, user.id)
        if conversation is None:
            raise ConversationNotFoundError
        return conversation

    def delete_conversation(self, clerk_user_id: str, conversation_id: str) -> None:
        conversation = self.get_conversation(clerk_user_id, conversation_id)
        self.repository.delete(conversation)

    def send_message(self, clerk_user_id: str, conversation_id: str, content: str) -> ChatResult:
        user = self.repository.get_or_create_user(clerk_user_id)
        conversation = self.repository.get_owned(conversation_id, user.id, lock=True)
        if conversation is None:
            raise ConversationNotFoundError

        history = [(message.role, message.content) for message in conversation.messages[-self.history_limit :]]
        if not conversation.messages:
            conversation.title = _conversation_title(content)
        user_message = self.repository.add_message(conversation, "user", content)
        db.session.commit()

        answer_result = self.medical_qa.answer(content, history)
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
        self, clerk_user_id: str, conversation_id: str, content: str
    ) -> PendingChatStream:
        user = self.repository.get_or_create_user(clerk_user_id)
        conversation = self.repository.get_owned(conversation_id, user.id, lock=True)
        if conversation is None:
            raise ConversationNotFoundError

        history = [(message.role, message.content) for message in conversation.messages[-self.history_limit :]]
        if not conversation.messages:
            conversation.title = _conversation_title(content)
        user_message = self.repository.add_message(conversation, "user", content)
        db.session.commit()

        answer_stream = self.medical_qa.stream_answer(content, history)
        return PendingChatStream(
            conversation=conversation,
            user_message=user_message,
            chunks=answer_stream.chunks,
            metadata=answer_stream.metadata,
        )

    def finish_message_stream(
        self,
        clerk_user_id: str,
        conversation_id: str,
        user_message: Message,
        content: str,
        metadata: dict,
    ) -> ChatResult:
        user = self.repository.get_or_create_user(clerk_user_id)
        conversation = self.repository.get_owned(conversation_id, user.id, lock=True)
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
