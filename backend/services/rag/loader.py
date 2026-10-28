from pathlib import Path
from threading import Lock

from backend.config import Settings
from backend.data.ingestion import load_cached_chunks
from backend.data.lexical_artifact import load_artifact_documents
from backend.integrations.openrouter import (
    create_chat_model,
    create_embeddings,
    create_review_model,
)
from backend.integrations.pinecone import open_vector_store
from backend.paths import DATA_DIR, REPOSITORY_ROOT

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
                    data_dir = DATA_DIR
                    if self.settings.lexical_cache_path:
                        artifact_path = Path(self.settings.lexical_cache_path)
                        if not artifact_path.is_absolute():
                            artifact_path = REPOSITORY_ROOT / artifact_path
                        lexical_documents = load_artifact_documents(
                            artifact_path, self.settings.chunk_size, self.settings.chunk_overlap
                        )
                    else:
                        lexical_documents = load_cached_chunks(data_dir, self.settings)
                    embeddings = create_embeddings(self.settings)
                    vector_store = open_vector_store(self.settings, embeddings)
                    self._service = MedicalQuestionAnswering(
                        vector_store,
                        create_chat_model(self.settings),
                        self.settings,
                        review_model=create_review_model(self.settings),
                        lexical_documents=lexical_documents,
                    )
        return self._service
