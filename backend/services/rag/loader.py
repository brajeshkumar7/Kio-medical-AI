from threading import Lock

from backend.config import Settings
from backend.data.ingestion import load_cached_chunks
from backend.integrations.openrouter import (
    create_chat_model,
    create_embeddings,
    create_review_model,
)
from backend.integrations.pinecone import open_vector_store
from backend.paths import DATA_DIR

from .pipeline import MedicalQuestionAnswering
from .types import MedicalAnswer, MedicalAnswerStream


class LazyMedicalQuestionAnswering:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._service = None
        self._lock = Lock()

    def answer(self, question: str, history: list[tuple[str, str]] | None = None) -> MedicalAnswer:
        return self._get_service().answer(question, history)

    def stream_answer(
        self, question: str, history: list[tuple[str, str]] | None = None
    ) -> MedicalAnswerStream:
        return self._get_service().stream_answer(question, history)

    def _get_service(self):
        if self._service is None:
            with self._lock:
                if self._service is None:
                    embeddings = create_embeddings(self.settings)
                    vector_store = open_vector_store(self.settings, embeddings)
                    data_dir = DATA_DIR
                    self._service = MedicalQuestionAnswering(
                        vector_store,
                        create_chat_model(self.settings),
                        self.settings,
                        review_model=create_review_model(self.settings),
                        lexical_documents=load_cached_chunks(data_dir, self.settings),
                    )
        return self._service
