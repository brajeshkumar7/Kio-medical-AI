"""Golden results captured from the implementation before moving modules."""

import hashlib
import json
from pathlib import Path

from langchain_core.documents import Document
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateIndex, CreateTable

from backend.config import Settings
from backend.data.ingestion import _cache_path
from backend.extensions import db
from backend.paths import CACHE_DIR, DATA_DIR, REPOSITORY_ROOT
from backend.services.rag.fusion import _fuse_documents, _unique_documents
from backend.services.rag.lexical import LexicalMedicalIndex
from backend.services.rag.sources import _format_context, _source_references
from backend.web import create_app

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


def test_retrieval_ranking_deduplication_and_context_match_baseline():
    expected = json.loads((FIXTURES / "retrieval.json").read_text(encoding="utf-8"))
    docs = [Document(page_content=d["text"], metadata=d["metadata"]) for d in expected["documents"]]
    lexical = LexicalMedicalIndex(docs).search("What is fever?", k=2)
    assert [d.metadata["id"] for d in lexical] == expected["lexical_ids"]
    fused = _fuse_documents([docs[3], docs[1], docs[0]], [docs[0], docs[3], docs[4]], 4)
    assert [d.metadata["id"] for d in fused] == expected["fused_ids"]
    unique = _unique_documents([docs[1], docs[2], docs[3]])
    assert [d.metadata["id"] for d in unique] == expected["unique_ids"]
    sources, per_doc = _source_references(unique)
    assert [s.as_dict() for s in sources] == expected["sources"]
    assert _format_context(unique, per_doc) == expected["context"]


def test_postgresql_schema_and_route_map_match_baseline():
    app = create_app(
        Settings(
            pinecone_api_key="test",
            openrouter_api_key="test",
            database_url="sqlite:///:memory:",
            clerk_issuer_url="https://example.invalid",
        ),
        medical_qa=object(),
        safety_checker=object(),
    )
    routes = sorted(
        [str(rule), sorted(rule.methods), rule.endpoint] for rule in app.url_map.iter_rules()
    )
    assert routes == json.loads((FIXTURES / "routes.json").read_text(encoding="utf-8"))
    ddl = []
    for table in db.metadata.sorted_tables:
        ddl.append(str(CreateTable(table).compile(dialect=postgresql.dialect())))
        ddl.extend(
            str(CreateIndex(i).compile(dialect=postgresql.dialect()))
            for i in sorted(table.indexes, key=lambda i: i.name)
        )
    assert "\n".join(ddl) == (FIXTURES / "schema.sql").read_text(encoding="utf-8")


def test_prompt_values_and_historical_migrations_are_unchanged():
    # Prompt formatting is source-level formatting only; string values must match.
    import ast

    current = ast.parse(
        (REPOSITORY_ROOT / "backend/prompts/medical.py").read_text(encoding="utf-8")
    )
    values = {
        n.targets[0].id: ast.literal_eval(n.value)
        for n in current.body
        if isinstance(n, ast.Assign)
    }
    assert values == json.loads((FIXTURES / "prompts.json").read_text(encoding="utf-8"))
    hashes = json.loads((FIXTURES / "protected-files.json").read_text(encoding="utf-8"))
    for name, expected in hashes.items():
        if name.startswith("migrations/"):
            assert hashlib.sha256((REPOSITORY_ROOT / name).read_bytes()).hexdigest() == expected


def test_default_paths_and_cache_fingerprint_are_stable(tmp_path):
    assert DATA_DIR == REPOSITORY_ROOT / "Data"
    assert CACHE_DIR == REPOSITORY_ROOT / ".cache"
    data = tmp_path / "Data"
    data.mkdir()
    pdf = data / "sample.pdf"
    pdf.write_bytes(b"synthetic PDF fixture")
    settings = Settings(pinecone_api_key="test", openrouter_api_key="test")
    fingerprint = {
        "version": 1,
        "chunk_size": 1200,
        "chunk_overlap": 180,
        "files": [(pdf.name, pdf.stat().st_size, pdf.stat().st_mtime_ns)],
    }
    digest = hashlib.sha256(json.dumps(fingerprint, sort_keys=True).encode()).hexdigest()[:16]
    assert _cache_path(data, settings) == tmp_path / ".cache" / f"medical-chunks-{digest}.json.gz"
