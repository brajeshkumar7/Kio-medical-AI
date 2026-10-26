from backend.config import Settings
from backend.extensions import db
from backend.jobs import purge_guests
from backend.web import create_app


def test_cleanup_needs_only_a_database_and_never_uses_qa(tmp_path, monkeypatch, capsys):
    url = f"sqlite:///{tmp_path / 'cleanup.db'}"
    app = create_app(
        Settings(
            pinecone_api_key="unused",
            openrouter_api_key="unused",
            database_url=url,
            clerk_issuer_url="https://unused.invalid",
        ),
        medical_qa=object(),
        safety_checker=object(),
    )
    with app.app_context():
        db.create_all()

    monkeypatch.setenv("DATABASE_URL", url)
    for name in (
        "OPENROUTER_API_KEY",
        "PINECONE_API_KEY",
        "CLERK_ISSUER_URL",
        "GUEST_IP_HASH_SECRET",
    ):
        monkeypatch.delenv(name, raising=False)

    def forbidden(*args, **kwargs):
        raise AssertionError("Database-only cleanup must not call external QA services")

    monkeypatch.setattr("backend.services.rag.loader.create_embeddings", forbidden)
    monkeypatch.setattr("backend.services.safety.SafetyChecker.check_input", forbidden)
    purge_guests.main()
    assert "Purged 0 expired guest sessions." in capsys.readouterr().out
