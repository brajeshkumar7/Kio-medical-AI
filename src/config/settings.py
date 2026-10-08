import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Settings:
    # API Keys
    PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY")
    OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
    
    # Validation
    if not PINECONE_API_KEY:
        raise ValueError("PINECONE_API_KEY environment variable is not set. Please add it to your .env file.")
    if not OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY environment variable is not set. Please add it to your .env file.")
        
    # OpenRouter Config
    OPENROUTER_BASE_URL = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    LLM_MODEL = os.environ.get("LLM_MODEL", "nvidia/nemotron-3.5-content-safety:free")
    EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "nvidia/llama-nemotron-embed-vl-1b-v2:free")
    
    # Pinecone Config
    PINECONE_INDEX_NAME = os.environ.get("PINECONE_INDEX_NAME", "medicalbot")
    EMBEDDING_DIMENSION = int(os.environ.get("EMBEDDING_DIMENSION", "2048"))
    
    # App Config
    HOST = os.environ.get("HOST", "0.0.0.0")
    PORT = int(os.environ.get("PORT", "8080"))
    DEBUG = os.environ.get("DEBUG", "True").lower() == "true"
    
    # Ingestion Config
    DATA_DIR = os.environ.get("DATA_DIR", "Data/")
    CHUNK_SIZE = int(os.environ.get("CHUNK_SIZE", "500"))
    CHUNK_OVERLAP = int(os.environ.get("CHUNK_OVERLAP", "20"))
