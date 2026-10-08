from pathlib import Path
from threading import Lock

from flask import Flask, jsonify
from flask_cors import CORS

from backend.ai.openrouter import create_chat_model, create_embeddings, create_review_model
from backend.api.conversations import conversations_api
from backend.auth import ClerkAuthenticator
from backend.config import Settings
from backend.data.ingestion import load_cached_chunks
from backend.extensions import db, migrate
from backend.repositories.conversations import ConversationRepository
from backend.services.conversation_memory import ConversationMemoryService
from backend.services.rag import MedicalQuestionAnswering
from backend.vector_store import open_vector_store


class LazyMedicalQuestionAnswering:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._service = None
        self._lock = Lock()

    def answer(self, question: str, history: list[tuple[str, str]] | None = None) -> str:
        return self._get_service().answer(question, history)

    def stream_answer(self, question: str, history: list[tuple[str, str]] | None = None):
        return self._get_service().stream_answer(question, history)

    def _get_service(self):
        if self._service is None:
            with self._lock:
                if self._service is None:
                    embeddings = create_embeddings(self.settings)
                    vector_store = open_vector_store(self.settings, embeddings)
                    data_dir = Path(__file__).resolve().parents[1] / "Data"
                    self._service = MedicalQuestionAnswering(
                        vector_store,
                        create_chat_model(self.settings),
                        self.settings,
                        review_model=create_review_model(self.settings),
                        lexical_documents=load_cached_chunks(data_dir, self.settings),
                    )
        return self._service


def create_app(
    settings: Settings | None = None,
    *,
    medical_qa=None,
    authenticator=None,
) -> Flask:
    settings = settings or Settings.from_env()
    app = Flask(__name__)
    app.config.update(
        SQLALCHEMY_DATABASE_URI=settings.database_url,
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SQLALCHEMY_ENGINE_OPTIONS={"pool_pre_ping": True},
    )
    CORS(
        app,
        resources={r"/api/*": {"origins": list(settings.clerk_authorized_parties)}},
        allow_headers=["Authorization", "Content-Type"],
    )

    db.init_app(app)
    migrate.init_app(app, db)

    medical_qa = medical_qa or LazyMedicalQuestionAnswering(settings)

    app.extensions["authenticator"] = authenticator or ClerkAuthenticator(settings)
    app.extensions["conversation_memory"] = ConversationMemoryService(
        ConversationRepository(), medical_qa, settings.history_message_limit
    )
    app.register_blueprint(conversations_api)

    @app.get("/health")
    def health():
        return jsonify({"status": "ok", "service": "kio-api"})

    return app
