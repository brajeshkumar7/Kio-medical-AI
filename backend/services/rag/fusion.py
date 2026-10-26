from langchain_core.documents import Document

from .sources import _page_number, _source_key


def _fuse_documents(semantic, lexical, limit: int) -> list[Document]:
    scores = {}
    documents = {}
    for ranking, weight in ((semantic, 1.0), (lexical, 1.25)):
        for rank, document in enumerate(ranking, start=1):
            key = _document_key(document)
            documents.setdefault(key, document)
            scores[key] = scores.get(key, 0.0) + weight / (60 + rank)
    ranked = sorted(scores, key=lambda key: (-scores[key], key))
    return [documents[key] for key in ranked[:limit]]


def _document_key(document):
    source = _source_key(str(document.metadata.get("source", "")))
    page = _page_number(document.metadata.get("page"))
    text = document.page_content.casefold()
    return source, page, text


def _unique_documents(documents: list[Document]) -> list[Document]:
    unique: list[Document] = []
    seen: set[tuple[str, int | None, str]] = set()
    for document in documents:
        source = str(document.metadata.get("source", "Medical source"))
        page = _page_number(document.metadata.get("page"))
        key = (_source_key(source), page, " ".join(document.page_content.split())[:240])
        if key not in seen:
            seen.add(key)
            unique.append(document)
    return unique
