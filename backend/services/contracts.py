"""Structural interfaces for injected services; no runtime validation or adapters."""

from __future__ import annotations

from collections.abc import Iterator
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from backend.services.safety import SafetyDecision

History = list[tuple[str, str]]


class Answer(Protocol):
    content: str

    @property
    def metadata(self) -> dict: ...


class AnswerStream(Protocol):
    chunks: Iterator[str]

    @property
    def metadata(self) -> dict: ...


class MedicalQA(Protocol):
    def answer(self, question: str, history: History | None = None) -> str | Answer: ...

    def stream_answer(self, question: str, history: History | None = None) -> AnswerStream: ...


class SafetyClassifier(Protocol):
    def check_input(self, question: str, history: History) -> SafetyDecision: ...

    def check_output(self, question: str, response: str, history: History) -> SafetyDecision: ...
