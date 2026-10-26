"""Public, token-scoped guest conversations and authenticated account transfer."""

from functools import wraps

from flask import Blueprint, Response, current_app, g, jsonify, request, stream_with_context
from openai import AuthenticationError

from backend.api.conversations import (
    _OPENROUTER_AUTH_ERROR,
    _conversation_json,
    _message_json,
    _stream_event,
)
from backend.auth import require_auth
from backend.extensions import db
from backend.services.conversation_memory import ConversationNotFoundError
from backend.services.guest_access import GuestAccessError, GuestQuotaExceeded
from backend.services.safety import SafetyCheckUnavailable, SAFETY_ERROR_CODE, SAFETY_RETRY_MESSAGE


guest_api = Blueprint("guests", __name__, url_prefix="/api/guest")


def _access():
    return current_app.extensions["guest_access"]


def _memory():
    return current_app.extensions["conversation_memory"]


def _ip() -> str:
    return request.remote_addr or "unknown"


def require_guest(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        authorization = request.headers.get("Authorization", "")
        token = authorization.removeprefix("Guest ").strip() if authorization.startswith("Guest ") else ""
        try:
            g.guest_session = _access().authenticate(token)
        except GuestAccessError:
            return jsonify({"error": "Guest session expired. Start a new guest session."}), 401
        return view(*args, **kwargs)
    return wrapped


def _guest_id() -> str:
    return g.guest_session.id


@guest_api.post("/sessions")
def create_guest_session():
    session, token = _access().create_session()
    response = jsonify({"token": token, **_access().status(session.id, _ip())})
    response.headers["Cache-Control"] = "no-store"
    return response, 201


@guest_api.get("/session")
@require_guest
def guest_status():
    return jsonify(_access().status(_guest_id(), _ip()))


@guest_api.get("/conversations")
@require_guest
def guest_conversations():
    items = _memory().list_conversations(_guest_id(), guest=True)
    return jsonify({"conversations": [_conversation_json(item) for item in items]})


@guest_api.post("/conversations")
@require_guest
def guest_create_conversation():
    item = _memory().create_conversation(_guest_id(), guest=True)
    return jsonify({"conversation": _conversation_json(item, include_messages=True)}), 201


@guest_api.get("/conversations/<conversation_id>")
@require_guest
def guest_get_conversation(conversation_id: str):
    try:
        item = _memory().get_conversation(_guest_id(), conversation_id, guest=True)
    except ConversationNotFoundError:
        return jsonify({"error": "Conversation not found"}), 404
    return jsonify({"conversation": _conversation_json(item, include_messages=True)})


@guest_api.delete("/conversations/<conversation_id>")
@require_guest
def guest_delete_conversation(conversation_id: str):
    try:
        _memory().delete_conversation(_guest_id(), conversation_id, guest=True)
    except ConversationNotFoundError:
        return jsonify({"error": "Conversation not found"}), 404
    return "", 204


@guest_api.post("/conversations/<conversation_id>/messages/stream")
@require_guest
def guest_stream_message(conversation_id: str):
    payload = request.get_json(silent=True) or {}
    content = str(payload.get("message", "")).strip()
    if not content:
        return jsonify({"error": "message is required"}), 400
    if len(content) > 8000:
        return jsonify({"error": "message must be 8000 characters or fewer"}), 400

    guest_id = _guest_id()
    try:
        _memory().get_conversation(guest_id, conversation_id, guest=True)
    except ConversationNotFoundError:
        return jsonify({"error": "Conversation not found"}), 404

    try:
        reservation = _access().reserve(guest_id, _ip())
    except GuestQuotaExceeded as error:
        message = (
            "Guest questions are used up for today. Sign in to continue."
            if error.code == "GUEST_LIMIT_REACHED"
            else "Guest access is busy on this network today. Sign in to continue."
        )
        return jsonify({
            "error": message,
            "code": error.code,
            "resetAt": error.reset_at.isoformat().replace("+00:00", "Z"),
        }), 429

    try:
        pending = _memory().start_message_stream(guest_id, conversation_id, content, guest=True)
    except Exception as error:
        db.session.rollback()
        _access().release(reservation)
        if isinstance(error, SafetyCheckUnavailable):
            return jsonify({"error": SAFETY_RETRY_MESSAGE, "code": SAFETY_ERROR_CODE}), 503
        if isinstance(error, ConversationNotFoundError):
            return jsonify({"error": "Conversation not found"}), 404
        if isinstance(error, AuthenticationError):
            current_app.logger.exception("OpenRouter authentication failed")
            return jsonify({"error": _OPENROUTER_AUTH_ERROR}), 502
        current_app.logger.exception("Guest question answering stream could not start")
        return jsonify({"error": "Unable to answer the question"}), 502

    start_conversation = _conversation_json(pending.conversation)
    start_user_message = _message_json(pending.user_message)

    @stream_with_context
    def generate():
        yield _stream_event(
            "start",
            conversation=start_conversation,
            userMessage=start_user_message,
            sources=pending.metadata.get("sources", []),
        )
        chunks = []
        try:
            for chunk in pending.chunks:
                chunks.append(chunk)
                yield _stream_event("delta", content=chunk)
            answer = "".join(chunks).strip()
            if not answer:
                raise RuntimeError("The answer model returned an empty response")
            result = _memory().finish_message_stream(
                guest_id, conversation_id, pending.user_message, answer, pending.metadata, guest=True
            )
            yield _stream_event(
                "complete",
                conversation=_conversation_json(result.conversation),
                userMessage=start_user_message,
                assistantMessage=_message_json(result.assistant_message),
            )
        except GeneratorExit:
            raise
        except Exception as error:
            db.session.rollback()
            _memory().discard_failed_guest_message(guest_id, conversation_id, pending.user_message.id)
            _access().release(reservation)
            if isinstance(error, SafetyCheckUnavailable):
                yield _stream_event("error", error=SAFETY_RETRY_MESSAGE, code=SAFETY_ERROR_CODE)
                return
            current_app.logger.exception("Guest question answering stream failed")
            yield _stream_event(
                "error",
                error=_OPENROUTER_AUTH_ERROR if isinstance(error, AuthenticationError)
                else "Unable to answer the question",
            )

    response = Response(generate(), content_type="application/x-ndjson; charset=utf-8")
    response.headers["Cache-Control"] = "no-cache, no-transform"
    response.headers["X-Accel-Buffering"] = "no"
    return response


@guest_api.post("/claim")
@require_auth
def claim_guest_conversations():
    token = request.headers.get("X-Kio-Guest-Token", "")
    try:
        count = _access().claim(token, g.authenticated_user.clerk_user_id)
    except GuestAccessError:
        return jsonify({"error": "Guest session cannot be transferred"}), 409
    return jsonify({"transferred": count})
