"""Fail-closed moderation, separate from retrieval and medical evidence review."""

from collections.abc import Iterator
from dataclasses import dataclass
import json
import logging
from time import monotonic

from langchain_core.messages import AIMessage, HumanMessage


logger = logging.getLogger(__name__)
SAFETY_ERROR_CODE = "SAFETY_CHECK_UNAVAILABLE"
SAFETY_RETRY_MESSAGE = "The safety check is temporarily unavailable. Please try again in a moment."
SAFE_REDIRECTION = (
    "I can help with general health information and safer next steps, but I can't provide "
    "instructions that could cause harm. If this concerns your safety or someone else's, "
    "you can tell me what is happening so I can help with safer next steps."
)


class SafetyCheckUnavailable(Exception):
    """A provider error or invalid classification must never become an allow decision."""


@dataclass(frozen=True)
class SafetyDecision:
    user_safe: bool
    response_safe: bool | None = None
    categories: tuple[str, ...] = ()


def parse_decision(text: str, *, output: bool) -> SafetyDecision:
    fields = {}
    for line in text.strip().splitlines():
        if not line.strip():
            continue
        key, separator, value = line.strip().partition(":")
        if not separator or key not in {"User Safety", "Response Safety", "Safety Categories"} or key in fields:
            raise SafetyCheckUnavailable(SAFETY_RETRY_MESSAGE)
        fields[key] = value.strip()
    required = ["User Safety", "Response Safety"] if output else ["User Safety"]
    if any(fields.get(key) not in {"safe", "unsafe"} for key in required):
        raise SafetyCheckUnavailable(SAFETY_RETRY_MESSAGE)
    if "Response Safety" in fields and fields["Response Safety"] not in {"safe", "unsafe"}:
        raise SafetyCheckUnavailable(SAFETY_RETRY_MESSAGE)
    categories = tuple(part.strip() for part in fields.get("Safety Categories", "").split(",") if part.strip())
    if categories and all(part.casefold() in {"none", "n/a"} for part in categories):
        categories = ()
    if categories and all(fields.get(key, "safe") == "safe" for key in ("User Safety", "Response Safety")):
        raise SafetyCheckUnavailable(SAFETY_RETRY_MESSAGE)
    if not output and fields.get("Response Safety") == "unsafe":
        raise SafetyCheckUnavailable(SAFETY_RETRY_MESSAGE)
    return SafetyDecision(
        user_safe=fields["User Safety"] == "safe",
        response_safe=(fields["Response Safety"] == "safe") if "Response Safety" in fields else None,
        categories=categories,
    )


class SafetyChecker:
    def __init__(self, model, *, history_limit: int = 12):
        self.model = model
        self.history_limit = history_limit

    def check_input(self, question: str, history) -> SafetyDecision:
        return self._check(question, history, response=None)

    def check_output(self, question: str, response: str, history) -> SafetyDecision:
        return self._check(question, history, response=response)

    def _check(self, question: str, history, *, response: str | None) -> SafetyDecision:
        stage = "input" if response is None else "output"
        started = monotonic()
        # NVIDIA's native format uses a user prompt and an optional assistant response.
        # Serialize context as data rather than interpolating it into a system instruction.
        context = list(history or [])[-self.history_limit:] if self.history_limit > 0 else []
        prompt = json.dumps({"conversation_context": context, "latest_user_message": question}, ensure_ascii=False)
        messages = [HumanMessage(content=prompt)]
        if response is not None:
            messages.append(AIMessage(content=response))
        try:
            result = self.model.invoke(messages)
            if result.response_metadata.get("finish_reason") in {"length", "content_filter"}:
                raise SafetyCheckUnavailable(SAFETY_RETRY_MESSAGE)
            if not isinstance(result.content, str):
                raise SafetyCheckUnavailable(SAFETY_RETRY_MESSAGE)
            decision = parse_decision(result.content, output=response is not None)
        except Exception:
            # Provider exceptions can contain submitted text. Do not log them or chain them.
            logger.warning("safety_check stage=%s outcome=unavailable model=%s duration_ms=%d", stage,
                           getattr(self.model, "model_name", "injected"), (monotonic() - started) * 1000)
            raise SafetyCheckUnavailable(SAFETY_RETRY_MESSAGE) from None
        allowed = decision.user_safe and (response is None or decision.response_safe is True)
        logger.info("safety_check stage=%s outcome=%s model=%s duration_ms=%d", stage,
                    "allowed" if allowed else "blocked", getattr(self.model, "model_name", "injected"),
                    (monotonic() - started) * 1000)
        return decision


@dataclass
class CheckedAnswer:
    content: str
    metadata: dict


@dataclass
class CheckedStream:
    chunks: Iterator[str]
    metadata: dict


class SafetyCheckedMedicalQA:
    """All entry points use the same gate, including injected QA implementations."""

    def __init__(self, medical_qa, checker):
        self.medical_qa = medical_qa
        self.checker = checker

    def answer(self, question: str, history=None):
        history = history or []
        if not self.checker.check_input(question, history).user_safe:
            return CheckedAnswer(SAFE_REDIRECTION, {"sources": []})
        result = self.medical_qa.answer(question, history)
        content = result if isinstance(result, str) else result.content
        decision = self.checker.check_output(question, content, history)
        if not decision.user_safe or decision.response_safe is not True:
            return CheckedAnswer(SAFE_REDIRECTION, {"sources": []})
        return result

    def stream_answer(self, question: str, history=None):
        history = history or []
        # This check runs eagerly, before the memory service commits the user turn.
        if not self.checker.check_input(question, history).user_safe:
            return CheckedStream(iter([SAFE_REDIRECTION]), {"sources": []})
        stream = self.medical_qa.stream_answer(question, history)
        metadata = {"sources": []}

        def approved_chunks():
            iterator = iter(stream.chunks)
            try:
                chunks = list(iterator)
            finally:
                close = getattr(iterator, "close", None)
                if close:
                    close()
            content = "".join(chunks)
            if not content.strip():
                raise RuntimeError("The answer model returned an empty response")
            decision = self.checker.check_output(question, content, history)
            if not decision.user_safe or decision.response_safe is not True:
                yield SAFE_REDIRECTION
                return
            metadata.update(stream.metadata)
            yield from chunks

        return CheckedStream(approved_chunks(), metadata)
