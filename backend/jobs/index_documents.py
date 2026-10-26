import argparse
import time

from langchain_pinecone import PineconeVectorStore

from backend.config import Settings
from backend.data.ingestion import load_cached_chunks
from backend.integrations.openrouter import create_embeddings
from backend.integrations.pinecone import create_index, index_names, pinecone_client
from backend.paths import DATA_DIR


def build_index(settings: Settings, recreate: bool = False, batch_size: int = 64) -> None:
    started_at = time.monotonic()
    print("Loading PDF documents...", flush=True)
    documents = load_cached_chunks(DATA_DIR, settings)
    print(f"Loaded and split source documents into {len(documents)} cached chunks.", flush=True)
    if not documents:
        raise ValueError("Document splitting produced no chunks")

    print(f"Created {len(documents)} chunks. Verifying embedding model...", flush=True)
    embeddings = create_embeddings(settings)
    dimension = len(embeddings.embed_query(documents[0].page_content))
    print(f"Embedding model ready ({dimension} dimensions).", flush=True)

    client = pinecone_client(settings)
    name = settings.pinecone_index_name
    if name in index_names(client):
        if not recreate:
            raise RuntimeError(
                f"Index '{name}' already exists. Use --recreate to rebuild it with the new embedding model."
            )
        print(f"Deleting existing Pinecone index '{name}'...", flush=True)
        client.delete_index(name)

    print(f"Creating Pinecone index '{name}'...", flush=True)
    create_index(client, name, dimension)
    store = PineconeVectorStore(index=client.Index(name), embedding=embeddings)
    total = len(documents)
    for start in range(0, total, batch_size):
        end = min(start + batch_size, total)
        print(f"Embedding and uploading chunks {start + 1}-{end} of {total}...", flush=True)
        store.add_documents(documents[start:end])
        elapsed = time.monotonic() - started_at
        print(f"Progress: {end}/{total} ({end / total:.1%}) in {elapsed:.0f}s", flush=True)

    elapsed = time.monotonic() - started_at
    print(
        f"Indexed {total} chunks in '{name}' ({dimension} dimensions) in {elapsed:.0f}s.",
        flush=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the Pinecone medical index")
    parser.add_argument(
        "--recreate", action="store_true", help="Delete and rebuild the existing index"
    )
    parser.add_argument(
        "--batch-size", type=int, default=64, help="Chunks embedded and uploaded per batch"
    )
    args = parser.parse_args()
    build_index(
        Settings.from_env(require_app_services=False),
        recreate=args.recreate,
        batch_size=args.batch_size,
    )


if __name__ == "__main__":
    main()
