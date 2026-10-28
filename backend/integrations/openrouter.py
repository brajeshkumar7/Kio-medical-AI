from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from backend.config import Settings


def _headers(settings: Settings) -> dict[str, str]:
    return {"HTTP-Referer": settings.frontend_origin, "X-Title": "KIO Medical AI"}


def create_embeddings(settings: Settings) -> OpenAIEmbeddings:
    return OpenAIEmbeddings(
        model=settings.embedding_model,
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
        check_embedding_ctx_length=False,
        model_kwargs={"encoding_format": "float"},
        chunk_size=32,
        timeout=45,
        max_retries=0,
    )


def create_chat_model(settings: Settings) -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.chat_model,
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
        temperature=0.15,
        max_tokens=settings.answer_max_tokens,
        timeout=120,
        max_retries=2,
        default_headers=_headers(settings),
        extra_body={"reasoning": {"effort": "none", "exclude": True}},
    )


def create_review_model(settings: Settings) -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.answer_review_model,
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
        temperature=0,
        max_tokens=settings.answer_max_tokens,
        timeout=180,
        max_retries=2,
        default_headers=_headers(settings),
        extra_body={"reasoning": {"effort": "none", "exclude": True}},
    )


def create_safety_model(settings: Settings) -> ChatOpenAI:
    """Create the classifier separately; it must never be used to generate answers."""
    return ChatOpenAI(
        model=settings.safety_model,
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
        temperature=0,
        max_tokens=1024,
        timeout=20,
        max_retries=0,
        default_headers=_headers(settings),
        # Reasoning and the verdict share max_tokens. Keep reasoning for nuanced
        # help-seeking classifications, with bounded room for complete labels.
        extra_body={
            "provider": {"zdr": True},
            "reasoning": {"enabled": True, "exclude": True},
        },
    )
