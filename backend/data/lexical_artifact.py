"""Portable, validated lexical chunks for read-only deployments.

Artifacts contain source text and must stay outside Git and public asset paths.
"""

import gzip
import hashlib
import json
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from langchain_core.documents import Document

FORMAT_VERSION = 1
MAX_COMPRESSED_BYTES = 32 * 1024 * 1024
MAX_JSON_BYTES = 128 * 1024 * 1024


class LexicalArtifactError(ValueError):
    """The deployment artifact cannot safely initialize lexical retrieval."""


def _canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, ensure_ascii=True, allow_nan=False).encode()


def _validate_records(records: Any) -> int:
    if not isinstance(records, list) or not records:
        raise LexicalArtifactError("Lexical artifact must contain nonempty chunk records")
    sources = set()
    for record in records:
        if (
            not isinstance(record, dict)
            or not isinstance(record.get("text"), str)
            or not record["text"].strip()
            or not isinstance(record.get("metadata"), dict)
            or not isinstance(record["metadata"].get("source"), str)
            or not record["metadata"]["source"]
        ):
            raise LexicalArtifactError("Invalid lexical chunk text or source metadata")
        sources.add(record["metadata"]["source"])
    return len(sources)


def read_compressed_json(path: Path) -> Any:
    try:
        if path.stat().st_size > MAX_COMPRESSED_BYTES:
            raise LexicalArtifactError("Lexical artifact exceeds compressed size limit")
        with gzip.open(path, "rb") as stream:
            payload = stream.read(MAX_JSON_BYTES + 1)
        if len(payload) > MAX_JSON_BYTES:
            raise LexicalArtifactError("Lexical artifact exceeds expanded size limit")
        return json.loads(payload)
    except (OSError, EOFError, UnicodeError, ValueError) as exc:
        raise LexicalArtifactError("Cannot read lexical artifact; export and redeploy it") from exc


def export_artifact(cache_path: Path, output: Path, chunk_size: int, overlap: int) -> dict:
    """Read an existing local cache only; never extract PDFs or call providers."""
    if chunk_size <= 0 or not 0 <= overlap < chunk_size:
        raise LexicalArtifactError("Invalid chunk size or overlap")
    records = read_compressed_json(cache_path)
    count = _validate_records(records)
    manifest = {
        "format_version": FORMAT_VERSION,
        "chunk_size": chunk_size,
        "chunk_overlap": overlap,
        "document_count": count,
        "chunk_count": len(records),
        "content_sha256": hashlib.sha256(_canonical(records)).hexdigest(),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(
        gzip.compress(_canonical({"manifest": manifest, "records": records}), mtime=0)
    )
    return manifest


def validate_artifact(path: Path, chunk_size: int, overlap: int) -> tuple[dict, list[dict]]:
    artifact = read_compressed_json(path)
    if not isinstance(artifact, dict) or not isinstance(artifact.get("manifest"), dict):
        raise LexicalArtifactError("Lexical artifact manifest is missing")
    manifest = artifact["manifest"]
    records = artifact.get("records")
    document_count = _validate_records(records)
    expected = {
        "format_version": FORMAT_VERSION,
        "chunk_size": chunk_size,
        "chunk_overlap": overlap,
        "document_count": document_count,
        "chunk_count": len(records),
        "content_sha256": hashlib.sha256(_canonical(records)).hexdigest(),
    }
    if manifest != expected:
        raise LexicalArtifactError(
            "Lexical artifact version, checksum, counts or chunk settings differ"
        )
    return manifest, records


def load_artifact_documents(path: Path, chunk_size: int, overlap: int) -> "list[Document]":
    from langchain_core.documents import Document

    _, records = validate_artifact(path, chunk_size, overlap)
    return [
        Document(page_content=record["text"], metadata=record["metadata"]) for record in records
    ]
