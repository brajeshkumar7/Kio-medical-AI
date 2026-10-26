from types import SimpleNamespace

import pytest
from langchain_core.documents import Document

import store_index
from backend.config import Settings
from backend.jobs import index_documents as indexing
from backend.paths import DATA_DIR


def test_pdf_discovery_retains_all_top_level_pdf_inputs(tmp_path, monkeypatch):
    from backend.data import ingestion

    documents = [
        Document(page_content="Text", metadata={"source": f"book-{i}.pdf"}) for i in range(16)
    ]
    for i in range(16):
        (tmp_path / f"book-{i}.pdf").write_bytes(b"synthetic fixture")
    seen = {}

    class Loader:
        def __init__(self, directory, *, glob, loader_cls):
            seen["files"] = sorted(p.name for p in tmp_path.glob(glob))

        def load(self):
            return documents

    monkeypatch.setattr(ingestion, "DirectoryLoader", Loader)
    assert ingestion.load_documents(tmp_path) == documents
    assert len(seen["files"]) == 16


def test_root_entry_point_forwards_the_existing_flags(monkeypatch):
    calls = []
    settings = Settings(pinecone_api_key="test", openrouter_api_key="test")
    monkeypatch.setattr(indexing.Settings, "from_env", lambda **_: settings)
    monkeypatch.setattr(
        indexing, "build_index", lambda *args, **kwargs: calls.append((args, kwargs))
    )
    monkeypatch.setattr("sys.argv", ["store_index.py", "--recreate", "--batch-size", "32"])
    store_index.main()
    assert calls == [((settings,), {"recreate": True, "batch_size": 32})]


@pytest.mark.parametrize("existing,recreate", [(False, False), (True, True)])
def test_indexing_preserves_dimension_detection_batch_order_and_recreation(
    monkeypatch, existing, recreate
):
    docs = [Document(page_content=f"chunk {i}") for i in range(5)]
    calls = []
    settings = Settings(
        pinecone_api_key="test",
        openrouter_api_key="test",
        pinecone_index_name="synthetic-test-index",
    )

    def load(data, config):
        assert data == DATA_DIR and config is settings
        return docs

    monkeypatch.setattr(indexing, "load_cached_chunks", load)
    monkeypatch.setattr(
        indexing, "create_embeddings", lambda _: SimpleNamespace(embed_query=lambda text: [1, 2, 3])
    )
    client = SimpleNamespace(
        Index=lambda name: name, delete_index=lambda name: calls.append(("delete", name))
    )
    monkeypatch.setattr(indexing, "pinecone_client", lambda _: client)
    monkeypatch.setattr(
        indexing, "index_names", lambda _: {settings.pinecone_index_name} if existing else set()
    )
    monkeypatch.setattr(
        indexing,
        "create_index",
        lambda client, name, dimension: calls.append(("create", name, dimension)),
    )
    monkeypatch.setattr(
        indexing,
        "PineconeVectorStore",
        lambda **_: SimpleNamespace(
            add_documents=lambda batch: calls.append(("upload", [d.page_content for d in batch]))
        ),
    )
    indexing.build_index(settings, recreate=recreate, batch_size=2)
    assert (
        ("delete", settings.pinecone_index_name) in calls
        if recreate
        else all(c[0] != "delete" for c in calls)
    )
    assert ("create", settings.pinecone_index_name, 3) in calls
    assert [c[1] for c in calls if c[0] == "upload"] == [
        ["chunk 0", "chunk 1"],
        ["chunk 2", "chunk 3"],
        ["chunk 4"],
    ]


def test_existing_index_is_not_deleted_without_recreate(monkeypatch):
    settings = Settings(pinecone_api_key="test", openrouter_api_key="test")
    monkeypatch.setattr(indexing, "load_cached_chunks", lambda *_: [Document(page_content="text")])
    monkeypatch.setattr(
        indexing, "create_embeddings", lambda _: SimpleNamespace(embed_query=lambda _: [1])
    )
    monkeypatch.setattr(indexing, "pinecone_client", lambda _: object())
    monkeypatch.setattr(indexing, "index_names", lambda _: {settings.pinecone_index_name})
    with pytest.raises(RuntimeError, match="already exists"):
        indexing.build_index(settings)
