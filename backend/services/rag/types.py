from collections.abc import Iterator
from dataclasses import dataclass


@dataclass(frozen=True)
class SourceReference:
    id: int
    title: str
    page: int | None

    def as_dict(self) -> dict:
        return {"id": self.id, "title": self.title, "page": self.page}


@dataclass(frozen=True)
class MedicalAnswer:
    content: str
    sources: list[SourceReference]

    @property
    def metadata(self) -> dict:
        return {"sources": [source.as_dict() for source in self.sources]}


@dataclass(frozen=True)
class MedicalAnswerStream:
    chunks: Iterator[str]
    sources: list[SourceReference]

    @property
    def metadata(self) -> dict:
        return {"sources": [source.as_dict() for source in self.sources]}
