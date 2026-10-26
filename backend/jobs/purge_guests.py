"""Run guest retention cleanup with only a database connection configured."""

import os

from backend.config import Settings, _normalize_database_url
from backend.web import create_app


def main() -> None:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required")
    app = create_app(Settings(
        pinecone_api_key="unused",
        openrouter_api_key="unused",
        database_url=_normalize_database_url(database_url),
        clerk_issuer_url="https://unused.invalid",
        guest_ip_hash_secret="unused",
    ))
    with app.app_context():
        count = app.extensions["guest_access"].purge_expired()
    print(f"Purged {count} expired guest sessions.")


if __name__ == "__main__":
    main()
