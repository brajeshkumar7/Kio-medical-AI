from pathlib import Path

from langchain_core.documents import Document

from .types import SourceReference


def _source_references(
    documents: list[Document],
) -> tuple[list[SourceReference], list[SourceReference]]:
    sources: list[SourceReference] = []
    document_sources: list[SourceReference] = []
    by_location: dict[tuple[str, int | None], SourceReference] = {}
    for document in documents:
        source = str(document.metadata.get("source", "Medical source"))
        page = _page_number(document.metadata.get("page"))
        key = (_source_key(source), page)
        reference = by_location.get(key)
        if reference is None:
            reference = SourceReference(
                id=len(sources) + 1,
                title=_source_title(source),
                page=page,
            )
            by_location[key] = reference
            sources.append(reference)
        document_sources.append(reference)
    return sources, document_sources


def _source_title(source: str) -> str:
    stem = Path(_source_key(source)).stem.lower()
    if stem == "medical_book":
        return "Gale Encyclopedia of Medicine, 2nd ed."
    return Path(_source_key(source)).stem.replace("_", " ")


def _source_key(source: str) -> str:
    return source.replace(chr(92), "/").rsplit("/", 1)[-1].casefold()


def _page_number(value) -> int | None:
    try:
        return int(value) + 1
    except (TypeError, ValueError):
        return None


def _format_context(documents: list[Document], sources: list[SourceReference]) -> str:
    if not documents:
        return "No relevant source excerpts were retrieved."
    sections = []
    for document, source in zip(documents, sources, strict=True):
        location = f", page {source.page}" if source.page is not None else ""
        text = " ".join(document.page_content.split())
        sections.append(f"[{source.id}] {source.title}{location}\n{text}")
    return "\n\n".join(sections)
