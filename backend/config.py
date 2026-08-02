from dataclasses import dataclass
import os
from urllib.parse import urlparse

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    pinecone_api_key: str
    openrouter_api_key: str
    database_url: str = ""
    clerk_issuer_url: str = ""
    clerk_authorized_parties: tuple[str, ...] = ("http://localhost:3000",)
    pinecone_index_name: str = "medicalbot"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    chat_model: str = "nvidia/nemotron-3-nano-30b-a3b:free"
    answer_review_model: str = "nvidia/nemotron-3-ultra-550b-a55b:free"
    safety_model: str = "nvidia/nemotron-3.5-content-safety:free"
    embedding_model: str = "nvidia/llama-nemotron-embed-vl-1b-v2:free"
    retrieval_k: int = 6
    retrieval_fetch_k: int = 16
    retrieval_lambda_mult: float = 0.65
    retrieval_lexical_k: int = 4
    retrieval_context_k: int = 8
    chunk_size: int = 1200
    chunk_overlap: int = 180
    answer_max_tokens: int = 1800
    answer_review_enabled: bool = True
    host: str = "0.0.0.0"
    port: int = 8080
    debug: bool = False
    frontend_origin: str = "http://localhost:3000"
    history_message_limit: int = 12

    @classmethod
    def from_env(cls, *, require_app_services: bool = True) -> "Settings":
        load_dotenv()
        required = {
            "PINECONE_API_KEY": os.getenv("PINECONE_API_KEY"),
            "OPENROUTER_API_KEY": os.getenv("OPENROUTER_API_KEY"),
        }
        if require_app_services:
            required.update(
                {
                    "DATABASE_URL": os.getenv("DATABASE_URL"),
                    "CLERK_ISSUER_URL": os.getenv("CLERK_ISSUER_URL"),
                }
            )
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise RuntimeError("Missing required environment variables: " + ", ".join(missing))
        return cls(
            pinecone_api_key=required["PINECONE_API_KEY"],
            openrouter_api_key=required["OPENROUTER_API_KEY"],
            database_url=_normalize_database_url(os.getenv("DATABASE_URL", "")),
            clerk_issuer_url=os.getenv("CLERK_ISSUER_URL", "").rstrip("/"),
            clerk_authorized_parties=_csv_values(
                os.getenv("CLERK_AUTHORIZED_PARTIES", os.getenv("FRONTEND_ORIGIN", "http://localhost:3000"))
            ),
            pinecone_index_name=os.getenv("PINECONE_INDEX_NAME", "medicalbot"),
            openrouter_base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
            chat_model=os.getenv("OPENROUTER_CHAT_MODEL", "nvidia/nemotron-3-nano-30b-a3b:free"),
            answer_review_model=os.getenv(
                "OPENROUTER_REVIEW_MODEL",
                "nvidia/nemotron-3-ultra-550b-a55b:free",
            ),
            safety_model=os.getenv("OPENROUTER_SAFETY_MODEL", "nvidia/nemotron-3.5-content-safety:free"),
            embedding_model=os.getenv("OPENROUTER_EMBEDDING_MODEL", "nvidia/llama-nemotron-embed-vl-1b-v2:free"),
            retrieval_k=int(os.getenv("RETRIEVAL_K", "6")),
            retrieval_fetch_k=int(os.getenv("RETRIEVAL_FETCH_K", "16")),
            retrieval_lambda_mult=float(os.getenv("RETRIEVAL_LAMBDA_MULT", "0.65")),
            retrieval_lexical_k=int(os.getenv("RETRIEVAL_LEXICAL_K", "4")),
            retrieval_context_k=int(os.getenv("RETRIEVAL_CONTEXT_K", "8")),
            chunk_size=int(os.getenv("CHUNK_SIZE", "1200")),
            chunk_overlap=int(os.getenv("CHUNK_OVERLAP", "180")),
            answer_max_tokens=int(os.getenv("ANSWER_MAX_TOKENS", "1800")),
            answer_review_enabled=os.getenv("ANSWER_REVIEW_ENABLED", "true").lower() == "true",
            host=os.getenv("FLASK_HOST", "0.0.0.0"),
            port=int(os.getenv("FLASK_PORT", "8080")),
            debug=os.getenv("FLASK_DEBUG", "false").lower() == "true",
            frontend_origin=os.getenv("FRONTEND_ORIGIN", "http://localhost:3000"),
            history_message_limit=int(os.getenv("HISTORY_MESSAGE_LIMIT", "12")),
        )


def _csv_values(value: str) -> tuple[str, ...]:
    return tuple(item.strip().rstrip("/") for item in value.split(",") if item.strip())


def _normalize_database_url(value: str) -> str:
    if not value:
        return value
    parsed = urlparse(value)
    if parsed.scheme in {"postgres", "postgresql"}:
        return value.replace(f"{parsed.scheme}://", "postgresql+psycopg://", 1)
    return value
