from langchain_openai import OpenAIEmbeddings
from src.config.settings import Settings

def get_embeddings() -> OpenAIEmbeddings:
    """
    Initializes and returns OpenAI-compatible embeddings pointing to OpenRouter
    using the configured embedding model.
    """
    return OpenAIEmbeddings(
        model=Settings.EMBEDDING_MODEL,
        openai_api_key=Settings.OPENROUTER_API_KEY,
        base_url=Settings.OPENROUTER_BASE_URL,
        check_embedding_ctx_length=False,  # Required for OpenRouter/custom embeddings to bypass local client validation
        model_kwargs={"encoding_format": "float"}
    )
