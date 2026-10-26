"""Historical migrations target PostgreSQL; SQLite remains a service-test database."""

import os

import pytest
from flask_migrate import downgrade, upgrade
from sqlalchemy import inspect, text

from backend.config import Settings
from backend.extensions import db
from backend.paths import REPOSITORY_ROOT
from backend.web import create_app


def application(url):
    return create_app(
        Settings(
            pinecone_api_key="test",
            openrouter_api_key="test",
            database_url=url,
            clerk_issuer_url="https://example.invalid",
        ),
        medical_qa=object(),
        safety_checker=object(),
    )


def test_sqlite_metadata_supports_existing_service_test_tables(tmp_path):
    app = application(f"sqlite:///{tmp_path / 'schema.db'}")
    with app.app_context():
        db.create_all()
        assert set(inspect(db.engine).get_table_names()) == set(db.metadata.tables)


def test_postgresql_migrations_compile_offline_without_connecting(capsys):
    # Offline SQL uses PostgreSQL's real dialect without requiring a local server.
    app = application("postgresql+psycopg://test:test@127.0.0.1:1/kio_offline_test")
    with app.app_context():
        upgrade(directory=str(REPOSITORY_ROOT / "migrations"), sql=True)
    sql = capsys.readouterr().out
    assert "CREATE TABLE users" in sql
    assert "CREATE TABLE guest_sessions" in sql
    assert "20261013_0002" in sql


@pytest.mark.postgres
def test_historical_migrations_on_disposable_postgresql():
    url = os.getenv("TEST_POSTGRES_URL")
    if not url:
        pytest.skip(
            "Set TEST_POSTGRES_URL to an empty disposable PostgreSQL database ending in _test"
        )
    from sqlalchemy.engine import make_url

    parsed = make_url(url)
    assert parsed.database and parsed.database.endswith("_test"), (
        "Refuse migrations against a non-test database"
    )
    app = application(url)
    with app.app_context():
        assert inspect(db.engine).get_table_names() == [], "Test database must start empty"
        directory = str(REPOSITORY_ROOT / "migrations")
        try:
            upgrade(directory=directory)
            assert (
                db.session.scalar(text("SELECT version_num FROM alembic_version"))
                == "20261013_0002"
            )
            assert set(db.metadata.tables) <= set(inspect(db.engine).get_table_names())
            downgrade(directory=directory, revision="base")
            assert set(inspect(db.engine).get_table_names()) <= {"alembic_version"}
            upgrade(directory=directory)
        finally:
            db.session.remove()
            downgrade(directory=directory, revision="base")
            with db.engine.begin() as connection:
                connection.execute(text("DROP TABLE IF EXISTS alembic_version"))
