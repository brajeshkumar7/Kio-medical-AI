import json
from datetime import datetime

from flask import Blueprint, Response, current_app, g, jsonify, request, stream_with_context

from backend.auth import require_auth
from backend.models import Conversation, Message
from backend.services.conversation_memory import ConversationNotFoundError


conversations_api = Blueprint("conversations", __name__, url_prefix="/api/conversations")


def _iso(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


def _message_json(message: Message) -> dict:
    return {
        "id": message.id,
        "role": message.role,
        "content": message.content,
        "sequence": message.sequence,
        "metadata": message.message_metadata,
        "createdAt": _iso(message.created_at),
    }


def _conversation_json(conversation: Conversation, *, include_messages: bool = False) -> dict:
    result = {
        "id": conversation.id,
        "title": conversation.title,
        "createdAt": _iso(conversation.created_at),
        "updatedAt": _iso(conversation.updated_at),
    }
    if include_messages:
        result["messages"] = [_message_json(message) for message in conversation.messages]
    return result


def _service():
    return current_app.extensions["conversation_memory"]


def _clerk_user_id() -> str:
    return g.authenticated_user.clerk_user_id


@conversations_api.get("")
@require_auth
def list_conversations():
    conversations = _service().list_conversations(_clerk_user_id())
    return jsonify({"conversations": [_conversation_json(item) for item in conversations]})


@conversations_api.post("")
@require_auth
def create_conversation():
    conversation = _service().create_conversation(_clerk_user_id())
    return jsonify({"conversation": _conversation_json(conversation, include_messages=True)}), 201


@conversations_api.get("/<conversation_id>")
@require_auth
def get_conversation(conversation_id: str):
    try:
        conversation = _service().get_conversation(_clerk_user_id(), conversation_id)
    except ConversationNotFoundError:
        return jsonify({"error": "Conversation not found"}), 404
    return jsonify({"conversation": _conversation_json(conversation, include_messages=True)})


@conversations_api.delete("/<conversation_id>")
@require_auth
def delete_conversation(conversation_id: str):
    try:
        _service().delete_conversation(_clerk_user_id(), conversation_id)
    except ConversationNotFoundError:
        return jsonify({"error": "Conversation not found"}), 404
    return "", 204


@conversations_api.post("/<conversation_id>/messages")
@require_auth
def send_message(conversation_id: str):
    payload = request.get_json(silent=True) or {}
    content = str(payload.get("message", "")).strip()
    if not content:
        return jsonify({"error": "message is required"}), 400
    if len(content) > 8000:
        return jsonify({"error": "message must be 8000 characters or fewer"}), 400

    try:
        result = _service().send_message(_clerk_user_id(), conversation_id, content)
    except ConversationNotFoundError:
        return jsonify({"error": "Conversation not found"}), 404
    except Exception:
        current_app.logger.exception("Question answering failed")
        return jsonify({"error": "Unable to answer the question"}), 502

    return jsonify(
        {
            "conversation": _conversation_json(result.conversation),
            "userMessage": _message_json(result.user_message),
            "assistantMessage": _message_json(result.assistant_message),
        }
    ), 201


@conversations_api.post("/<conversation_id>/messages/stream")
@require_auth
def stream_message(conversation_id: str):
    payload = request.get_json(silent=True) or {}
    content = str(payload.get("message", "")).strip()
    if not content:
        return jsonify({"error": "message is required"}), 400
    if len(content) > 8000:
        return jsonify({"error": "message must be 8000 characters or fewer"}), 400

    clerk_user_id = _clerk_user_id()
    try:
        pending = _service().start_message_stream(clerk_user_id, conversation_id, content)
    except ConversationNotFoundError:
        return jsonify({"error": "Conversation not found"}), 404
    except Exception:
        current_app.logger.exception("Question answering stream could not start")
        return jsonify({"error": "Unable to answer the question"}), 502

    start_conversation = _conversation_json(pending.conversation)
    start_user_message = _message_json(pending.user_message)
    sources = pending.metadata.get("sources", [])

    @stream_with_context
    def generate():
        yield _stream_event(
            "start",
            conversation=start_conversation,
            userMessage=start_user_message,
            sources=sources,
        )
        chunks: list[str] = []
        try:
            for chunk in pending.chunks:
                chunks.append(chunk)
                yield _stream_event("delta", content=chunk)

            answer = "".join(chunks).strip()
            if not answer:
                raise RuntimeError("The answer model returned an empty response")
            result = _service().finish_message_stream(
                clerk_user_id,
                conversation_id,
                pending.user_message,
                answer,
                pending.metadata,
            )
            yield _stream_event(
                "complete",
                conversation=_conversation_json(result.conversation),
                userMessage=start_user_message,
                assistantMessage=_message_json(result.assistant_message),
            )
        except GeneratorExit:
            raise
        except Exception:
            current_app.logger.exception("Question answering stream failed")
            yield _stream_event("error", error="Unable to answer the question")

    response = Response(generate(), content_type="application/x-ndjson; charset=utf-8")
    response.headers["Cache-Control"] = "no-cache, no-transform"
    response.headers["X-Accel-Buffering"] = "no"
    return response


def _stream_event(event_type: str, **payload) -> str:
    return json.dumps({"type": event_type, **payload}, ensure_ascii=False) + "\n"
