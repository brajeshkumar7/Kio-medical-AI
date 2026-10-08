from pathlib import Path
import gzip
import hashlib
import json

from langchain_community.document_loaders import DirectoryLoader, PyPDFLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from backend.config import Settings


_CACHE_VERSION = 1

def load_documents(data_dir: str | Path):
    data_dir = Path(data_dir)
    if not data_dir.exists():
        raise FileNotFoundError(f"Data directory does not exist: {data_dir}")
    documents = DirectoryLoader(str(data_dir), glob="*.pdf", loader_cls=PyPDFLoader).load()
    if not documents:
        raise ValueError(f"No PDF files found in {data_dir}")
    return documents

def split_documents(documents, settings: Settings):
    splitter = RecursiveCharacterTextSplitter(chunk_size=settings.chunk_size, chunk_overlap=settings.chunk_overlap)
    chunks = splitter.split_documents(documents)
    for index, chunk in enumerate(chunks):
        chunk.metadata["chunk_index"] = index
    return chunks


def load_cached_chunks(data_dir: str | Path, settings: Settings) -> list[Document]:
    data_dir = Path(data_dir)
    cache_path = _cache_path(data_dir, settings)
    if cache_path.exists():
        try:
            with gzip.open(cache_path, "rt", encoding="utf-8") as cache_file:
                records = json.load(cache_file)
            return [
                Document(page_content=item["text"], metadata=item["metadata"])
                for item in records
            ]
        except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError):
            cache_path.unlink(missing_ok=True)

    chunks = split_documents(load_documents(data_dir), settings)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = cache_path.with_suffix(cache_path.suffix + ".tmp")
    records = [{"text": chunk.page_content, "metadata": chunk.metadata} for chunk in chunks]
    with gzip.open(temporary_path, "wt", encoding="utf-8") as cache_file:
        json.dump(records, cache_file, ensure_ascii=True, default=str)
    temporary_path.replace(cache_path)
    return chunks


def _cache_path(data_dir: Path, settings: Settings) -> Path:
    pdfs = sorted(data_dir.glob("*.pdf"))
    fingerprint = {
        "version": _CACHE_VERSION,
        "chunk_size": settings.chunk_size,
        "chunk_overlap": settings.chunk_overlap,
        "files": [(pdf.name, pdf.stat().st_size, pdf.stat().st_mtime_ns) for pdf in pdfs],
    }
    encoded = json.dumps(fingerprint, sort_keys=True).encode()
    digest = hashlib.sha256(encoded).hexdigest()[:16]
    return data_dir.parent / ".cache" / f"medical-chunks-{digest}.json.gz"
