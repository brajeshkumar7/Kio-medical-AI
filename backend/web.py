from flask import Flask, jsonify
from flask_cors import CORS
from sqlalchemy.pool import NullPool
from werkzeug.middleware.proxy_fix import ProxyFix

from backend.api.conversations import conversations_api
from backend.api.guests import guest_api
from backend.auth import ClerkAuthenticator
from backend.config import Settings
from backend.extensions import db, migrate
from backend.integrations.openrouter import (
    create_safety_model,
)
from backend.repositories.conversations import ConversationRepository
from backend.services.conversation_memory import ConversationMemoryService
from backend.services.guest_access import GuestAccessService
from backend.services.rag.loader import LazyMedicalQuestionAnswering
from backend.services.safety import SafetyCheckedMedicalQA, SafetyChecker


def create_app(
    settings: Settings | None = None,
    *,
    medical_qa=None,
    authenticator=None,
    safety_checker=None,
) -> Flask:
    settings = settings or Settings.from_env()
    app = Flask(__name__)
    engine_options = {"pool_pre_ping": True}
    if settings.database_pool_mode == "null":
        engine_options["poolclass"] = NullPool
    elif settings.database_pool_mode != "default":
        raise ValueError("DATABASE_POOL_MODE must be default or null")
    if settings.trusted_proxy_hops:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=settings.trusted_proxy_hops)
    app.config.update(
        SQLALCHEMY_DATABASE_URI=settings.database_url,
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SQLALCHEMY_ENGINE_OPTIONS=engine_options,
    )
    CORS(
        app,
        resources={
            r"/api/*": {"origins": list(settings.clerk_authorized_parties)},
            r"/health": {"origins": list(settings.clerk_authorized_parties)},
        },
        allow_headers=["Authorization", "Content-Type", "X-Kio-Guest-Token"],
    )

    db.init_app(app)
    migrate.init_app(app, db)

    medical_qa = medical_qa or LazyMedicalQuestionAnswering(settings)
    safety_checker = safety_checker or SafetyChecker(
        create_safety_model(settings), history_limit=settings.history_message_limit
    )
    app.extensions["safety_checker"] = safety_checker
    medical_qa = SafetyCheckedMedicalQA(medical_qa, safety_checker)

    app.extensions["authenticator"] = authenticator or ClerkAuthenticator(settings)
    app.extensions["conversation_memory"] = ConversationMemoryService(
        ConversationRepository(), medical_qa, settings.history_message_limit
    )
    app.extensions["guest_access"] = GuestAccessService(settings.guest_ip_hash_secret)
    app.register_blueprint(conversations_api)
    app.register_blueprint(guest_api)

    @app.cli.command("purge-guests")
    def purge_guests():
        count = app.extensions["guest_access"].purge_expired()
        print(f"Purged {count} expired guest sessions.")

    @app.get("/health")
    def health():
        return jsonify({"status": "ok", "service": "kio-api"})

    return app
