import pytest
import httpx
from openai import AuthenticationError
from types import SimpleNamespace

from backend.auth import AuthenticatedUser
from backend.ai.prompts import SYSTEM_PROMPT
from backend.config import Settings
from backend.extensions import db
from backend.services.conversation_memory import _metadata_for_cited_sources
from backend.web import create_app


class FakeAuthenticator:
    def authenticate(self, authorization):
        if not authorization or not authorization.startswith("Bearer user-"):
            raise ValueError("invalid token")
        return AuthenticatedUser(authorization.removeprefix("Bearer "))


class FakeMedicalQA:
    def __init__(self):
        self.calls = []

    def answer(self, question, history):
        self.calls.append((question, history))
        return f"Answer to: {question}"

    def stream_answer(self, question, history):
        self.calls.append((question, history))
        answer = f"Answer to: {question}"
        return SimpleNamespace(
            chunks=iter([answer[:7], answer[7:]]),
            metadata={"sources": []},
        )


@pytest.fixture()
def app(tmp_path, safety_checker):
    qa = FakeMedicalQA()
    settings = Settings(
        pinecone_api_key="test",
        openrouter_api_key="test",
        database_url=f"sqlite:///{tmp_path / 'kio.db'}",
        clerk_issuer_url="https://example.clerk.accounts.dev",
    )
    application = create_app(
        settings,
        medical_qa=qa,
        authenticator=FakeAuthenticator(),
        safety_checker=safety_checker,
    )
    application.config.update(TESTING=True)
    application.extensions["fake_qa"] = qa
    with application.app_context():
        db.create_all()
    yield application


@pytest.fixture()
def client(app):
    return app.test_client()


def auth(user="user-one"):
    return {"Authorization": f"Bearer {user}"}


def test_conversation_memory_and_user_ownership(app, client):
    assert client.get("/api/conversations").status_code == 401

    created = client.post("/api/conversations", headers=auth())
    assert created.status_code == 201
    conversation_id = created.get_json()["conversation"]["id"]

    first = client.post(
        f"/api/conversations/{conversation_id}/messages",
        headers=auth(),
        json={"message": "What causes a fever?"},
    )
    assert first.status_code == 201
    assert first.get_json()["conversation"]["title"] == "What causes a fever?"
    assert first.get_json()["assistantMessage"]["metadata"] == {}

    second = client.post(
        f"/api/conversations/{conversation_id}/messages",
        headers=auth(),
        json={"message": "When should I seek care?"},
    )
    assert second.status_code == 201

    detail = client.get(f"/api/conversations/{conversation_id}", headers=auth()).get_json()
    assert [message["role"] for message in detail["conversation"]["messages"]] == [
        "user",
        "assistant",
        "user",
        "assistant",
    ]
    assert app.extensions["fake_qa"].calls[1][1] == [
        ("user", "What causes a fever?"),
        ("assistant", "Answer to: What causes a fever?"),
    ]

    assert client.get(f"/api/conversations/{conversation_id}", headers=auth("user-two")).status_code == 404
    assert client.get("/api/conversations", headers=auth("user-two")).get_json() == {
        "conversations": []
    }


def test_delete_conversation(client):
    created = client.post("/api/conversations", headers=auth()).get_json()["conversation"]
    assert client.delete(f"/api/conversations/{created['id']}", headers=auth()).status_code == 204
    assert client.get(f"/api/conversations/{created['id']}", headers=auth()).status_code == 404


def test_rejects_invalid_messages(client):
    created = client.post("/api/conversations", headers=auth()).get_json()["conversation"]
    endpoint = f"/api/conversations/{created['id']}/messages"
    assert client.post(endpoint, headers=auth(), json={"message": "  "}).status_code == 400
    assert client.post(endpoint, headers=auth(), json={"message": "x" * 8001}).status_code == 400


def test_streams_and_persists_assistant_message(app, client):
    conversation = client.post("/api/conversations", headers=auth()).get_json()["conversation"]
    response = client.post(
        f"/api/conversations/{conversation['id']}/messages/stream",
        headers=auth(),
        json={"message": "What causes a cough?"},
    )

    assert response.status_code == 200
    events = [__import__("json").loads(line) for line in response.text.splitlines()]
    assert [event["type"] for event in events] == ["start", "delta", "delta", "complete"]
    assert "".join(event.get("content", "") for event in events) == "Answer to: What causes a cough?"
    assert events[-1]["assistantMessage"]["content"] == "Answer to: What causes a cough?"

    detail = client.get(
        f"/api/conversations/{conversation['id']}", headers=auth()
    ).get_json()["conversation"]
    assert [message["role"] for message in detail["messages"]] == ["user", "assistant"]


def test_stream_reports_openrouter_authentication_failure(app, client):
    conversation = client.post("/api/conversations", headers=auth()).get_json()["conversation"]

    def reject_key(_question, _history):
        response = httpx.Response(
            401,
            request=httpx.Request("POST", "https://openrouter.ai/api/v1/embeddings"),
        )
        raise AuthenticationError("User not found", response=response, body=None)

    app.extensions["fake_qa"].stream_answer = reject_key
    response = client.post(
        f"/api/conversations/{conversation['id']}/messages/stream",
        headers=auth(),
        json={"message": "What causes a cough?"},
    )

    assert response.status_code == 502
    assert "Update OPENROUTER_API_KEY" in response.get_json()["error"]


def test_only_sources_cited_in_answer_are_exposed():
    metadata = {
        "sources": [
            {"id": 1, "title": "Relevant source", "page": 10},
            {"id": 2, "title": "Retrieved but unused", "page": 20},
        ]
    }

    result = _metadata_for_cited_sources("Supported statement [1].", metadata)

    assert result["sources"] == [{"id": 1, "title": "Relevant source", "page": 10}]

    full_width = _metadata_for_cited_sources("根拠のある記述【2】。", metadata)
    assert full_width["sources"] == [
        {"id": 2, "title": "Retrieved but unused", "page": 20}
    ]


def test_medical_prompt_enforces_evidence_categories_and_language_quality():
    assert "Common findings, associated effects, complications, and warning signs" in SYSTEM_PROMPT
    assert "Never invent thresholds, durations, treatment steps, or reasons to seek care" in SYSTEM_PROMPT
    assert "Do not leak untranslated English words" in SYSTEM_PROMPT
    assert "Use a Markdown table only for a genuine comparison" in SYSTEM_PROMPT


@pytest.mark.parametrize("streaming", [False, True])
@pytest.mark.parametrize("stage", ["input", "output"])
def test_safety_blocks_are_safe_responses_without_rejected_text(app, client, safety_checker, streaming, stage):
    from backend.services.safety import SAFE_REDIRECTION
    safety_checker.input_safe = stage != "input"
    safety_checker.output_safe = stage != "output"
    conversation = client.post("/api/conversations", headers=auth()).get_json()["conversation"]
    suffix = "/messages/stream" if streaming else "/messages"
    response = client.post(f"/api/conversations/{conversation['id']}{suffix}", headers=auth(), json={"message": "Test question"})
    assert response.status_code == (200 if streaming else 201)
    if streaming:
        events = [__import__("json").loads(line) for line in response.text.splitlines()]
        assert "".join(e.get("content", "") for e in events) == SAFE_REDIRECTION
        assert events[-1]["assistantMessage"]["metadata"]["sources"] == []
    else:
        assert response.get_json()["assistantMessage"]["content"] == SAFE_REDIRECTION
    saved = client.get(f"/api/conversations/{conversation['id']}", headers=auth()).get_json()["conversation"]["messages"]
    assert saved[-1]["content"] == SAFE_REDIRECTION
    assert "Answer to:" not in saved[-1]["content"]
    if stage == "input":
        assert app.extensions["fake_qa"].calls == []


@pytest.mark.parametrize("streaming", [False, True])
@pytest.mark.parametrize("stage", ["input", "output"])
def test_safety_unavailable_never_saves_or_streams_an_answer(client, safety_checker, streaming, stage):
    safety_checker.fail_stage = stage
    conversation = client.post("/api/conversations", headers=auth()).get_json()["conversation"]
    suffix = "/messages/stream" if streaming else "/messages"
    response = client.post(f"/api/conversations/{conversation['id']}{suffix}", headers=auth(), json={"message": "Test question"})
    if streaming and stage == "output":
        assert response.status_code == 200
        events = [__import__("json").loads(line) for line in response.text.splitlines()]
        assert [e["type"] for e in events] == ["start", "error"]
        assert events[-1]["code"] == "SAFETY_CHECK_UNAVAILABLE"
    else:
        assert response.status_code == 503
        assert response.get_json()["code"] == "SAFETY_CHECK_UNAVAILABLE"
    saved = client.get(f"/api/conversations/{conversation['id']}", headers=auth()).get_json()["conversation"]["messages"]
    assert not any(m["role"] == "assistant" for m in saved)
    if stage == "input" or not streaming:
        assert saved == []


def test_ownership_is_checked_before_moderation(client, safety_checker):
    conversation = client.post("/api/conversations", headers=auth()).get_json()["conversation"]
    response = client.post(f"/api/conversations/{conversation['id']}/messages/stream", headers=auth("user-two"), json={"message": "Test"})
    assert response.status_code == 404
    assert safety_checker.calls == []
