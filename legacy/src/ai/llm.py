from langchain_openai import ChatOpenAI
from src.config.settings import Settings

def get_llm() -> ChatOpenAI:
    """
    Initializes and returns ChatOpenAI client pointing to OpenRouter
    using the configured LLM model.
    """
    return ChatOpenAI(
        model=Settings.LLM_MODEL,
        openai_api_key=Settings.OPENROUTER_API_KEY,
        base_url=Settings.OPENROUTER_BASE_URL,
        temperature=0.3,
        max_tokens=512
    )
