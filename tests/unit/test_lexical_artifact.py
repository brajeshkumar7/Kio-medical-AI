import gzip
import hashlib
import json
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace

import pytest
from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableLambda
from sqlalchemy.pool import NullPool

from backend.config import Settings
from backend.data.ingestion import _cache_path, load_cached_chunks
from backend.data.lexical_artifact import (
    LexicalArtifactError,
    export_artifact,
    load_artifact_documents,
    validate_artifact,
)
from backend.extensions import db
from backend.jobs import export_lexical_cache, prepare_vercel_cache
from backend.jobs.check_vercel_bundle import check_bundle
from backend.services.rag import loader
from backend.web import create_app


@pytest.fixture
def records():
    return [
        {
            "text": "A cough clears the airways.",
            "metadata": {
                "source": "Data/book.pdf",
                "page": 10,
                "chunk_index": 0,
            },
        },
        {
            "text": "A persistent cough needs assessment.",
            "metadata": {
                "source": "Data/second.pdf",
                "page": 3,
                "chunk_index": 1,
            },
        },
    ]


@pytest.fixture
def artifact(tmp_path, records):
    cache = tmp_path / "cache.gz"
    cache.write_bytes(gzip.compress(json.dumps(records).encode()))
    path = tmp_path / "lexical.gz"
    export_artifact(cache, path, 1200, 180)
    return path


def test_export_preserves_chunk_order_text_metadata_and_is_deterministic(
    tmp_path, records, artifact
):
    manifest, result = validate_artifact(artifact, 1200, 180)
    assert result == records
    assert manifest["document_count"] == 2
    assert manifest["chunk_count"] == 2
    other = tmp_path / "other.gz"
    export_artifact(tmp_path / "cache.gz", other, 1200, 180)
    assert artifact.read_bytes() == other.read_bytes()
    docs = load_artifact_documents(artifact, 1200, 180)
    assert [(d.page_content, d.metadata) for d in docs] == [
        (record["text"], record["metadata"]) for record in records
    ]


@pytest.mark.parametrize(
    "field,value",
    [
        ("content_sha256", "bad"),
        ("format_version", 2),
        ("chunk_count", 99),
        ("document_count", 99),
        ("chunk_size", 500),
        ("chunk_overlap", 80),
    ],
)
def test_rejects_incompatible_or_tampered_manifest(artifact, field, value):
    payload = json.loads(gzip.decompress(artifact.read_bytes()))
    payload["manifest"][field] = value
    artifact.write_bytes(gzip.compress(json.dumps(payload).encode()))
    with pytest.raises(LexicalArtifactError):
        validate_artifact(artifact, 1200, 180)


@pytest.mark.parametrize("payload", [b"invalid", gzip.compress(b"null"), gzip.compress(b"[]")])
def test_rejects_unreadable_artifact(tmp_path, payload):
    path = tmp_path / "bad.gz"
    path.write_bytes(payload)
    with pytest.raises(LexicalArtifactError):
        validate_artifact(path, 1200, 180)


def test_missing_artifact_never_falls_back_to_pdfs(tmp_path, monkeypatch):
    monkeypatch.setattr(loader, "load_cached_chunks", lambda *_: pytest.fail("PDF fallback"))
    monkeypatch.setattr(loader, "create_embeddings", lambda *_: pytest.fail("provider call"))
    qa = loader.LazyMedicalQuestionAnswering(
        Settings(
            pinecone_api_key="test",
            openrouter_api_key="test",
            lexical_cache_path=str(tmp_path / "missing.gz"),
        )
    )
    with pytest.raises(LexicalArtifactError):
        qa.answer("What is a cough?")


def test_read_only_artifact_answers_through_real_pipeline_with_mocked_providers(
    artifact,
    monkeypatch,
    safety_checker,
):
    class VectorStore:
        def as_retriever(self, **_kwargs):
            return RunnableLambda(lambda _: [])

    monkeypatch.setattr(loader, "load_cached_chunks", lambda *_: pytest.fail("PDF fallback"))
    monkeypatch.setattr(loader, "create_embeddings", lambda *_: object())
    monkeypatch.setattr(loader, "open_vector_store", lambda *_: VectorStore())
    model = RunnableLambda(
        lambda *_args, **_kw: AIMessage(content="A cough clears the airways [1].")
    )
    monkeypatch.setattr(loader, "create_chat_model", lambda *_: model)
    monkeypatch.setattr(loader, "create_review_model", lambda *_: model)
    monkeypatch.setattr(Path, "write_bytes", lambda *_: pytest.fail("runtime file write"))
    monkeypatch.setattr(Path, "mkdir", lambda *_args, **_kw: pytest.fail("runtime mkdir"))
    application = create_app(
        Settings(
            pinecone_api_key="test",
            openrouter_api_key="test",
            database_url="sqlite://",
            clerk_issuer_url="https://example.invalid",
            lexical_cache_path=str(artifact),
        ),
        safety_checker=safety_checker,
    )
    result = application.extensions["conversation_memory"].medical_qa.answer("What is a cough?")
    assert result.content == "A cough clears the airways [1]."
    assert result.sources
    assert [stage for stage, _ in safety_checker.calls] == ["input", "output"]


def test_original_local_cache_selection_stays_unchanged(tmp_path, records):
    data = tmp_path / "Data"
    data.mkdir()
    (data / "book.pdf").write_bytes(b"not parsed when cache exists")
    settings = Settings(pinecone_api_key="test", openrouter_api_key="test")
    cache = _cache_path(data, settings)
    cache.parent.mkdir()
    cache.write_bytes(gzip.compress(json.dumps(records).encode()))
    assert [d.page_content for d in load_cached_chunks(data, settings)] == [
        r["text"] for r in records
    ]


def test_export_cli_only_reads_existing_matching_cache(tmp_path, records, monkeypatch, capsys):
    data = tmp_path / "Data"
    data.mkdir()
    (data / "one.pdf").write_bytes(b"not a real PDF")
    cache = _cache_path(data, SimpleNamespace(chunk_size=1200, chunk_overlap=180))
    cache.parent.mkdir()
    cache.write_bytes(gzip.compress(json.dumps(records).encode()))
    output = tmp_path / "export.gz"
    monkeypatch.setattr(
        "sys.argv",
        [
            "export",
            "--data-dir",
            str(data),
            "--output",
            str(output),
            "--chunk-size",
            "1200",
            "--chunk-overlap",
            "180",
        ],
    )
    export_lexical_cache.main()
    assert "SHA256:" in capsys.readouterr().out
    assert validate_artifact(output, 1200, 180)[1] == records


def build_env(artifact):
    return {
        "LEXICAL_CACHE_ARTIFACT_URL": "https://example.private.blob.vercel-storage.com/cache.gz",
        "LEXICAL_CACHE_ARTIFACT_SHA256": hashlib.sha256(artifact.read_bytes()).hexdigest(),
        "BLOB_READ_WRITE_TOKEN": "test-secret",
        "LEXICAL_CACHE_PATH": "backend/_artifacts/lexical-cache.json.gz",
    }


def fake_download(monkeypatch, payload, status=200):
    @contextmanager
    def stream(method, url, **kwargs):
        assert method == "GET"
        assert kwargs["follow_redirects"] is False
        assert kwargs["headers"]["Authorization"] == "Bearer test-secret"
        yield SimpleNamespace(
            status_code=status, iter_bytes=lambda: iter([payload[:9], payload[9:]])
        )

    monkeypatch.setattr(prepare_vercel_cache.httpx, "stream", stream)


def test_build_download_validates_then_replaces_atomically(artifact, tmp_path, monkeypatch):
    fake_download(monkeypatch, artifact.read_bytes())
    output = tmp_path / "built/cache.gz"
    assert prepare_vercel_cache.prepare_cache(build_env(artifact), output)["chunk_count"] == 2
    assert output.read_bytes() == artifact.read_bytes()
    assert not output.with_suffix(".tmp").exists()


@pytest.mark.parametrize("status", [302, 401, 403, 404])
def test_failed_build_download_preserves_previous_artifact(artifact, monkeypatch, status):
    original = artifact.read_bytes()
    fake_download(monkeypatch, b"bad", status)
    with pytest.raises(LexicalArtifactError, match=f"HTTP {status}"):
        prepare_vercel_cache.prepare_cache(build_env(artifact), artifact)
    assert artifact.read_bytes() == original


def test_build_rejects_checksum_and_settings_mismatches(artifact, monkeypatch):
    original = artifact.read_bytes()
    fake_download(monkeypatch, b"tampered")
    with pytest.raises(LexicalArtifactError, match="SHA256"):
        prepare_vercel_cache.prepare_cache(build_env(artifact), artifact)
    fake_download(monkeypatch, original)
    env = {**build_env(artifact), "CHUNK_SIZE": "500"}
    with pytest.raises(LexicalArtifactError):
        prepare_vercel_cache.prepare_cache(env, artifact)
    assert artifact.read_bytes() == original
    assert not artifact.with_suffix(".tmp").exists()


@pytest.mark.parametrize(
    "url",
    [
        "http://example.private.blob.vercel-storage.com/a",
        "https://example.com/a",
        "https://example.private.blob.vercel-storage.com.evil.test/a",
        "https://user:pass@example.private.blob.vercel-storage.com/a",
        "https://example.private.blob.vercel-storage.com/a?token=secret",
    ],
)
def test_invalid_build_url_never_receives_credentials(artifact, monkeypatch, url):
    monkeypatch.setattr(
        prepare_vercel_cache.httpx, "stream", lambda *_a, **_k: pytest.fail("network")
    )
    with pytest.raises(LexicalArtifactError):
        prepare_vercel_cache.prepare_cache(
            {**build_env(artifact), "LEXICAL_CACHE_ARTIFACT_URL": url}
        )


def test_serverless_database_pooling_and_proxy_address(tmp_path):
    app = create_app(
        Settings(
            pinecone_api_key="test",
            openrouter_api_key="test",
            database_url=f"sqlite:///{tmp_path / 'pool.db'}",
            clerk_issuer_url="https://example.invalid",
            database_pool_mode="null",
            trusted_proxy_hops=1,
        ),
        medical_qa=object(),
        safety_checker=object(),
    )
    with app.app_context():
        assert isinstance(db.engine.pool, NullPool)
    from flask import request

    app.add_url_rule("/test-ip", view_func=lambda: request.remote_addr)
    assert (
        app.test_client()
        .get("/test-ip", headers={"X-Forwarded-For": "198.51.100.5, 203.0.113.8"})
        .text
        == "203.0.113.8"
    )


def test_invalid_pool_mode_is_a_configuration_error():
    with pytest.raises(ValueError, match="DATABASE_POOL_MODE"):
        create_app(
            Settings(pinecone_api_key="test", openrouter_api_key="test", database_pool_mode="typo")
        )


def test_bundle_inspection_requires_real_output(tmp_path):
    with pytest.raises(ValueError, match="No .func"):
        check_bundle(tmp_path, 1200, 180)


def test_bundle_inspection_checks_artifact_and_rejects_source_files(tmp_path, artifact):
    function = tmp_path / "app.func"
    cache = function / "backend/_artifacts/lexical-cache.json.gz"
    cache.parent.mkdir(parents=True)
    cache.write_bytes(artifact.read_bytes())
    assert check_bundle(tmp_path, 1200, 180) == [("app.func", artifact.stat().st_size)]
    pdf = function / "private.pdf"
    pdf.write_bytes(b"private")
    with pytest.raises(ValueError, match="Forbidden deployment file"):
        check_bundle(tmp_path, 1200, 180)


def test_build_download_limit_preserves_previous_file(artifact, monkeypatch):
    original = artifact.read_bytes()
    fake_download(monkeypatch, original)
    monkeypatch.setattr(prepare_vercel_cache, "MAX_COMPRESSED_BYTES", 1)
    with pytest.raises(LexicalArtifactError, match="size limit"):
        prepare_vercel_cache.prepare_cache(build_env(artifact), artifact)
    assert artifact.read_bytes() == original
