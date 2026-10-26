from datetime import datetime

from backend.models import Conversation, Message


def iso_datetime(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


def message_json(message: Message) -> dict:
    return {
        "id": message.id,
        "role": message.role,
        "content": message.content,
        "sequence": message.sequence,
        "metadata": message.message_metadata,
        "createdAt": iso_datetime(message.created_at),
    }


def conversation_json(conversation: Conversation, *, include_messages: bool = False) -> dict:
    result = {
        "id": conversation.id,
        "title": conversation.title,
        "createdAt": iso_datetime(conversation.created_at),
        "updatedAt": iso_datetime(conversation.updated_at),
    }
    if include_messages:
        result["messages"] = [message_json(message) for message in conversation.messages]
    return result
