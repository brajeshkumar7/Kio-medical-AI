import time
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone, ServerlessSpec
from backend.config import Settings

def pinecone_client(settings: Settings) -> Pinecone:
    return Pinecone(api_key=settings.pinecone_api_key)

def index_names(client: Pinecone) -> set[str]:
    return set(client.list_indexes().names())

def wait_until_ready(client: Pinecone, name: str, timeout: int = 120) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if client.describe_index(name).status.ready:
            return
        time.sleep(2)
    raise TimeoutError(f"Pinecone index was not ready within {timeout} seconds")

def create_index(client: Pinecone, name: str, dimension: int) -> None:
    client.create_index(name=name, dimension=dimension, metric="cosine", spec=ServerlessSpec(cloud="aws", region="us-east-1"))
    wait_until_ready(client, name)

def open_vector_store(settings: Settings, embeddings) -> PineconeVectorStore:
    client = pinecone_client(settings)
    if settings.pinecone_index_name not in index_names(client):
        raise RuntimeError(f"Pinecone index '{settings.pinecone_index_name}' does not exist. Run 'python store_index.py --recreate' first.")
    wait_until_ready(client, settings.pinecone_index_name)
    return PineconeVectorStore(index=client.Index(settings.pinecone_index_name), embedding=embeddings)
