from flask import Blueprint, current_app, g, jsonify, request, stream_with_context
from openai import AuthenticationError

from backend.api.errors import OPENROUTER_AUTH_ERROR
from backend.api.serialization import conversation_json, message_json
from backend.api.streaming import ndjson_response, stream_event
from backend.auth import require_auth
from backend.extensions import db
from backend.services.conversation_memory import ConversationNotFoundError
from backend.services.safety import SAFETY_ERROR_CODE, SAFETY_RETRY_MESSAGE, SafetyCheckUnavailable

conversations_api = Blueprint("conversations", __name__, url_prefix="/api/conversations")


def _service():
    return current_app.extensions["conversation_memory"]


def _clerk_user_id() -> str:
    return g.authenticated_user.clerk_user_id


@conversations_api.get("")
@require_auth
def list_conversations():
    conversations = _service().list_conversations(_clerk_user_id())
    return jsonify({"conversations": [conversation_json(item) for item in conversations]})


@conversations_api.post("")
@require_auth
def create_conversation():
    conversation = _service().create_conversation(_clerk_user_id())
    return jsonify({"conversation": conversation_json(conversation, include_messages=True)}), 201


@conversations_api.get("/<conversation_id>")
@require_auth
def get_conversation(conversation_id: str):
    try:
        conversation = _service().get_conversation(_clerk_user_id(), conversation_id)
    except ConversationNotFoundError:
        return jsonify({"error": "Conversation not found"}), 404
    return jsonify({"conversation": conversation_json(conversation, include_messages=True)})


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
    except SafetyCheckUnavailable:
        db.session.rollback()
        return jsonify({"error": SAFETY_RETRY_MESSAGE, "code": SAFETY_ERROR_CODE}), 503
    except AuthenticationError:
        current_app.logger.exception("OpenRouter authentication failed")
        return jsonify({"error": OPENROUTER_AUTH_ERROR}), 502
    except Exception:
        current_app.logger.exception("Question answering failed")
        return jsonify({"error": "Unable to answer the question"}), 502

    return jsonify(
        {
            "conversation": conversation_json(result.conversation),
            "userMessage": message_json(result.user_message),
            "assistantMessage": message_json(result.assistant_message),
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
    except SafetyCheckUnavailable:
        db.session.rollback()
        return jsonify({"error": SAFETY_RETRY_MESSAGE, "code": SAFETY_ERROR_CODE}), 503
    except AuthenticationError:
        current_app.logger.exception("OpenRouter authentication failed")
        return jsonify({"error": OPENROUTER_AUTH_ERROR}), 502
    except Exception:
        current_app.logger.exception("Question answering stream could not start")
        return jsonify({"error": "Unable to answer the question"}), 502

    start_conversation = conversation_json(pending.conversation)
    start_user_message = message_json(pending.user_message)
    sources = pending.metadata.get("sources", [])

    @stream_with_context
    def generate():
        yield stream_event(
            "start",
            conversation=start_conversation,
            userMessage=start_user_message,
            sources=sources,
        )
        chunks: list[str] = []
        try:
            for chunk in pending.chunks:
                chunks.append(chunk)
                yield stream_event("delta", content=chunk)

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
            yield stream_event(
                "complete",
                conversation=conversation_json(result.conversation),
                userMessage=start_user_message,
                assistantMessage=message_json(result.assistant_message),
            )
        except GeneratorExit:
            raise
        except SafetyCheckUnavailable:
            db.session.rollback()
            yield stream_event("error", error=SAFETY_RETRY_MESSAGE, code=SAFETY_ERROR_CODE)
        except AuthenticationError:
            current_app.logger.exception("OpenRouter authentication failed during streaming")
            yield stream_event("error", error=OPENROUTER_AUTH_ERROR)
        except Exception:
            current_app.logger.exception("Question answering stream failed")
            yield stream_event("error", error="Unable to answer the question")

    return ndjson_response(generate())
