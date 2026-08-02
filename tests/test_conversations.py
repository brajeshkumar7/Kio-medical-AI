import pytest
from types import SimpleNamespace

from backend.auth import AuthenticatedUser
from backend.ai.prompts import EVIDENCE_REVIEW_PROMPT, SYSTEM_PROMPT
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
def app(tmp_path):
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
    assert "two to five descriptive headings" in SYSTEM_PROMPT
    assert "compact Markdown table" in SYSTEM_PROMPT
    assert "Do not repeat the user's question as a heading" in SYSTEM_PROMPT
    assert "never flatten a well-structured draft" in EVIDENCE_REVIEW_PROMPT
    assert "Formatting never justifies adding a fact" in EVIDENCE_REVIEW_PROMPT
