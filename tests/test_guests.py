from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from backend.auth import AuthenticatedUser
from backend.config import Settings
from backend.extensions import db
from backend.models import Conversation, GuestDailyUsage, GuestIpDailyUsage, GuestSession
from backend.services.guest_access import GuestQuotaExceeded
from backend.web import create_app


class FakeAuthenticator:
    def authenticate(self, authorization):
        if not authorization or not authorization.startswith("Bearer user-"):
            raise ValueError("invalid token")
        return AuthenticatedUser(authorization.removeprefix("Bearer "))


class FakeMedicalQA:
    fail_at_start = False
    fail_during_stream = False

    def stream_answer(self, question, history):
        if self.fail_at_start:
            raise RuntimeError("provider unavailable")

        def chunks():
            if self.fail_during_stream:
                raise RuntimeError("provider unavailable")
            yield f"Answer to: {question}"

        return SimpleNamespace(chunks=chunks(), metadata={"sources": []})


@pytest.fixture()
def app(tmp_path, safety_checker):
    qa = FakeMedicalQA()
    settings = Settings(
        pinecone_api_key="test",
        openrouter_api_key="test",
        database_url=f"sqlite:///{tmp_path / 'guests.db'}",
        clerk_issuer_url="https://example.clerk.accounts.dev",
        guest_ip_hash_secret="test-only-secret",
    )
    application = create_app(settings, medical_qa=qa, authenticator=FakeAuthenticator(), safety_checker=safety_checker)
    application.config.update(TESTING=True)
    application.extensions["fake_qa"] = qa
    with application.app_context():
        db.create_all()
    return application


@pytest.fixture()
def client(app):
    return app.test_client()


def new_guest(client, ip="127.0.0.1"):
    response = client.post("/api/guest/sessions", environ_base={"REMOTE_ADDR": ip})
    assert response.status_code == 201
    return response.get_json()["token"]


def guest_headers(token):
    return {"Authorization": f"Guest {token}"}


def test_health_check_is_available_to_frontend(client):
    response = client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:3000"


def new_conversation(client, token):
    response = client.post("/api/guest/conversations", headers=guest_headers(token))
    assert response.status_code == 201
    return response.get_json()["conversation"]["id"]


def ask(client, token, conversation_id, question="What causes a cough?", ip="127.0.0.1"):
    return client.post(
        f"/api/guest/conversations/{conversation_id}/messages/stream",
        headers=guest_headers(token),
        json={"message": question},
        environ_base={"REMOTE_ADDR": ip},
    )


def test_guest_allowance_history_and_ownership(client):
    token = new_guest(client)
    other_token = new_guest(client)
    conversation = new_conversation(client, token)
    assert client.get(f"/api/guest/conversations/{conversation}", headers=guest_headers(other_token)).status_code == 404
    assert client.get(f"/api/conversations/{conversation}", headers={"Authorization": "Bearer user-one"}).status_code == 404

    for remaining in (2, 1, 0):
        response = ask(client, token, conversation)
        assert response.status_code == 200
        assert b'"type": "complete"' in response.data
        status = client.get("/api/guest/session", headers=guest_headers(token)).get_json()
        assert status["remaining"] == remaining
    fourth = ask(client, token, conversation)
    assert fourth.status_code == 429
    assert fourth.get_json()["code"] == "GUEST_LIMIT_REACHED"
    assert fourth.get_json()["resetAt"].endswith("T00:00:00Z")
    detail = client.get(f"/api/guest/conversations/{conversation}", headers=guest_headers(token)).get_json()
    assert len(detail["conversation"]["messages"]) == 6


def test_network_cap_across_sessions(app, client):
    ip = "203.0.113.17"
    with app.app_context():
        access = app.extensions["guest_access"]
        for _ in range(20):
            session, _ = access.create_session()
            for _ in range(3):
                access.reserve(session.id, ip)
        extra, _ = access.create_session()
        with pytest.raises(GuestQuotaExceeded) as error:
            access.reserve(extra.id, ip)
        assert error.value.code == "GUEST_NETWORK_LIMIT"
        assert access.status(extra.id, ip)["remaining"] == 0
        assert access.status(extra.id, "203.0.113.18")["remaining"] == 3
        stored_hash = db.session.scalar(select(GuestIpDailyUsage.ip_hash))
        assert len(stored_hash) == 64 and ip not in stored_hash


def test_provider_failures_refund_and_remove_unanswered_message(app, client):
    token = new_guest(client)
    conversation = new_conversation(client, token)
    qa = app.extensions["fake_qa"]
    qa.fail_at_start = True
    assert ask(client, token, conversation).status_code == 502
    qa.fail_at_start = False
    qa.fail_during_stream = True
    response = ask(client, token, conversation)
    assert response.status_code == 200
    assert b'"type": "error"' in response.data
    assert client.get("/api/guest/session", headers=guest_headers(token)).get_json()["remaining"] == 3
    detail = client.get(f"/api/guest/conversations/{conversation}", headers=guest_headers(token)).get_json()
    assert detail["conversation"]["messages"] == []
    qa.fail_during_stream = False
    assert b'"type": "complete"' in ask(client, token, conversation).data


def test_claim_once_and_expired_session_cleanup(app, client):
    token = new_guest(client)
    conversation = new_conversation(client, token)
    assert b'"type": "complete"' in ask(client, token, conversation).data
    claim_headers = {"Authorization": "Bearer user-one", "X-Kio-Guest-Token": token}
    first = client.post("/api/guest/claim", headers=claim_headers)
    assert first.status_code == 200
    assert first.get_json()["transferred"] == 1
    assert client.post("/api/guest/claim", headers=claim_headers).get_json()["transferred"] == 0
    assert client.post("/api/guest/claim", headers={"Authorization": "Bearer user-two", "X-Kio-Guest-Token": token}).status_code == 409
    assert client.get(f"/api/guest/conversations/{conversation}", headers=guest_headers(token)).status_code == 401
    assert client.get(f"/api/conversations/{conversation}", headers={"Authorization": "Bearer user-one"}).status_code == 200
    assert client.get(f"/api/conversations/{conversation}", headers={"Authorization": "Bearer user-two"}).status_code == 404

    expired_token = new_guest(client)
    expired_conversation = new_conversation(client, expired_token)
    with app.app_context():
        session = app.extensions["guest_access"].authenticate(expired_token)
        session.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.session.commit()
    assert client.get("/api/guest/session", headers=guest_headers(expired_token)).status_code == 401
    with app.app_context():
        assert app.extensions["guest_access"].purge_expired() == 1
        assert db.session.get(Conversation, expired_conversation) is None


def test_midnight_utc_reset(app, monkeypatch):
    import backend.services.guest_access as module

    before = datetime(2026, 10, 13, 23, 59, 59, tzinfo=timezone.utc)
    monkeypatch.setattr(module, "utc_now", lambda: before)
    with app.app_context():
        access = app.extensions["guest_access"]
        session, _ = access.create_session()
        for _ in range(3):
            access.reserve(session.id, "198.51.100.8")
        assert access.status(session.id, "198.51.100.8") == {
            "remaining": 0, "limit": 3, "resetAt": "2026-10-14T00:00:00Z"
        }
        monkeypatch.setattr(module, "utc_now", lambda: before + timedelta(seconds=1))
        assert access.status(session.id, "198.51.100.8")["remaining"] == 3


def test_concurrent_reservations_never_exceed_allowance(app):
    with app.app_context():
        session, _ = app.extensions["guest_access"].create_session()
        session_id = session.id

    def reserve_one(_):
        with app.app_context():
            try:
                app.extensions["guest_access"].reserve(session_id, "192.0.2.44")
                return True
            except GuestQuotaExceeded:
                return False

    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(reserve_one, range(6)))
    assert results.count(True) == 3
    assert results.count(False) == 3
    with app.app_context():
        used = db.session.scalar(select(GuestDailyUsage.used).where(GuestDailyUsage.guest_session_id == session_id))
        assert used == 3


def test_aborted_generation_consumes_question(client):
    token = new_guest(client)
    conversation = new_conversation(client, token)
    response = client.post(
        f"/api/guest/conversations/{conversation}/messages/stream",
        headers=guest_headers(token),
        json={"message": "A question"},
        buffered=False,
    )
    assert response.status_code == 200
    assert b'"type": "start"' in next(response.response)
    response.close()
    assert client.get("/api/guest/session", headers=guest_headers(token)).get_json()["remaining"] == 2


@pytest.mark.parametrize("stage", ["input", "output"])
def test_guest_safety_failure_refunds_and_removes_message(client, safety_checker, stage):
    safety_checker.fail_stage = stage
    token = new_guest(client)
    conversation = new_conversation(client, token)
    response = ask(client, token, conversation)
    if stage == "input":
        assert response.status_code == 503
        assert response.get_json()["code"] == "SAFETY_CHECK_UNAVAILABLE"
    else:
        assert response.status_code == 200
        events = [__import__("json").loads(line) for line in response.text.splitlines()]
        assert [e["type"] for e in events] == ["start", "error"]
        assert events[-1]["code"] == "SAFETY_CHECK_UNAVAILABLE"
    assert client.get("/api/guest/session", headers=guest_headers(token)).get_json()["remaining"] == 3
    detail = client.get(f"/api/guest/conversations/{conversation}", headers=guest_headers(token)).get_json()["conversation"]
    assert detail["messages"] == []
    assert detail["title"] == "New conversation"


@pytest.mark.parametrize("stage", ["input", "output"])
def test_guest_safety_redirection_is_saved_and_consumes_one_question(app, client, safety_checker, stage):
    from backend.services.safety import SAFE_REDIRECTION
    safety_checker.input_safe = stage != "input"
    safety_checker.output_safe = stage != "output"
    token = new_guest(client)
    conversation = new_conversation(client, token)
    response = ask(client, token, conversation)
    events = [__import__("json").loads(line) for line in response.text.splitlines()]
    assert "".join(e.get("content", "") for e in events) == SAFE_REDIRECTION
    assert events[-1]["assistantMessage"]["content"] == SAFE_REDIRECTION
    assert events[-1]["assistantMessage"]["metadata"]["sources"] == []
    assert client.get("/api/guest/session", headers=guest_headers(token)).get_json()["remaining"] == 2
