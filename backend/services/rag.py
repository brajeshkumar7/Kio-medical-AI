import math
import re
from collections import Counter
from collections.abc import Iterator
from dataclasses import dataclass
from difflib import get_close_matches
from pathlib import Path

from langchain.chains import create_history_aware_retriever
from langchain_core.documents import Document
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from backend.ai.prompts import CONTEXTUALIZE_PROMPT, EVIDENCE_REVIEW_PROMPT, SYSTEM_PROMPT
from backend.config import Settings


_TOKEN_PATTERN = re.compile(r"[^\W_]+", re.UNICODE)
_STOP_WORDS = {
    "a", "about", "an", "and", "are", "as", "at", "be", "can", "define",
    "describe", "do", "does", "explain", "for", "from", "give", "how", "i",
    "in", "is", "it", "kind", "kinds", "me", "of", "on", "or", "please",
    "some", "tell", "the", "this", "to", "type", "types", "what", "when",
    "where", "which", "who", "why", "with",
}
_COMMON_QUERY_TYPOS = {"typ": "type"}


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


class LexicalMedicalIndex:
    def __init__(self, documents):
        self.documents = documents
        self.tokens = [_tokens(document.page_content) for document in documents]
        self.term_frequencies = [Counter(tokens) for tokens in self.tokens]
        self.document_lengths = [len(tokens) for tokens in self.tokens]
        self.average_length = sum(self.document_lengths) / max(len(self.document_lengths), 1)
        document_frequency = Counter()
        for tokens in self.tokens:
            document_frequency.update(set(tokens))
        count = len(documents)
        self.inverse_document_frequency = {
            term: math.log(1 + (count - frequency + 0.5) / (frequency + 0.5))
            for term, frequency in document_frequency.items()
        }
        self.vocabulary = tuple(self.inverse_document_frequency)

    def search(self, query: str, *, k: int) -> list[Document]:
        query_terms = self._query_terms(query)
        if not query_terms or not self.documents:
            return []
        scored = []
        for index, frequencies in enumerate(self.term_frequencies):
            score = self._score(query_terms, frequencies, self.document_lengths[index])
            score += self._definition_bonus(query_terms, self.documents[index].page_content)
            if score > 0:
                scored.append((score, index))
        scored.sort(key=lambda item: (-item[0], item[1]))
        primary = [index for _, index in scored[:k]]
        ranked = list(primary)
        for index in primary[:2]:
            for neighbor in (index - 1, index + 1):
                if self._is_neighbor(index, neighbor) and neighbor not in ranked:
                    ranked.append(neighbor)
        return [self.documents[index] for index in ranked]

    def _query_terms(self, query: str) -> list[str]:
        normalized = []
        plural_roots = set()
        for term in _tokens(query):
            term = _COMMON_QUERY_TYPOS.get(term, term)
            singular = term[:-1] if term.endswith("s") else ""
            if singular in self.inverse_document_frequency:
                term = singular
                plural_roots.add(term)
            elif term not in self.inverse_document_frequency and len(term) >= 5:
                matches = get_close_matches(term, self.vocabulary, n=1, cutoff=0.86)
                if matches:
                    term = matches[0]
            if term not in _STOP_WORDS and term not in normalized:
                normalized.append(term)
        return [
            term for term in normalized
            if not any(term != root and _one_edit_apart(term, root) for root in plural_roots)
        ]

    def _is_neighbor(self, origin: int, candidate: int) -> bool:
        if candidate < 0 or candidate >= len(self.documents):
            return False
        first = Path(str(self.documents[origin].metadata.get("source", ""))).name
        second = Path(str(self.documents[candidate].metadata.get("source", ""))).name
        return first.casefold() == second.casefold()

    def _score(self, query_terms, frequencies, length: int) -> float:
        score = 0.0
        length_ratio = length / max(self.average_length, 1)
        for term in query_terms:
            frequency = frequencies.get(term, 0)
            if not frequency:
                continue
            denominator = frequency + 1.5 * (0.25 + 0.75 * length_ratio)
            score += self.inverse_document_frequency.get(term, 0.0) * (
                frequency * 2.5 / denominator
            )
        return score

    def _definition_bonus(self, query_terms, text: str) -> float:
        normalized = text.casefold()
        bonus = 0.0
        for term in query_terms:
            pattern = rf"(?:^|\n)\s*{re.escape(term)}\s*(?:-|\u2014|\u2013|is\b)"
            if re.search(pattern, normalized):
                bonus += self.inverse_document_frequency.get(term, 0.0) * 3
        return bonus


class MedicalQuestionAnswering:
    def __init__(
        self,
        vector_store,
        chat_model,
        settings: Settings,
        review_model=None,
        lexical_documents: list[Document] | None = None,
    ):
        self.chat_model = chat_model
        retriever = vector_store.as_retriever(
            search_type="mmr",
            search_kwargs={
                "k": settings.retrieval_k,
                "fetch_k": settings.retrieval_fetch_k,
                "lambda_mult": settings.retrieval_lambda_mult,
            },
        )
        contextualize_prompt = ChatPromptTemplate.from_messages(
            [
                ("system", CONTEXTUALIZE_PROMPT),
                MessagesPlaceholder("chat_history"),
                ("human", "{input}"),
            ]
        )
        query_model = chat_model.bind(max_tokens=128, temperature=0)
        self.retriever = create_history_aware_retriever(query_model, retriever, contextualize_prompt)
        self.lexical_index = LexicalMedicalIndex(lexical_documents or [])
        self.retrieval_lexical_k = settings.retrieval_lexical_k
        self.retrieval_context_k = settings.retrieval_context_k
        self.answer_prompt = ChatPromptTemplate.from_messages(
            [
                ("system", SYSTEM_PROMPT),
                MessagesPlaceholder("chat_history"),
                ("human", "{input}"),
            ]
        )
        self.review_prompt = ChatPromptTemplate.from_messages(
            [("system", EVIDENCE_REVIEW_PROMPT)]
        )
        self.review_model = (review_model or chat_model).bind(
            max_tokens=settings.answer_max_tokens,
            temperature=0,
        )
        self.review_enabled = settings.answer_review_enabled

    def answer(self, question: str, history: list[tuple[str, str]] | None = None) -> MedicalAnswer:
        answer_stream = self.stream_answer(question, history)
        content = "".join(answer_stream.chunks).strip()
        if not content:
            raise RuntimeError("The answer model returned an empty response")
        return MedicalAnswer(content=content, sources=answer_stream.sources)

    def stream_answer(
        self, question: str, history: list[tuple[str, str]] | None = None
    ) -> MedicalAnswerStream:
        chat_history = _chat_messages(history or [])
        semantic_documents = self.retriever.invoke(
            {"input": question, "chat_history": chat_history}
        )
        lexical_documents = self.lexical_index.search(
            question,
            k=self.retrieval_lexical_k,
        )
        documents = _fuse_documents(
            semantic_documents,
            lexical_documents,
            self.retrieval_context_k,
        )
        documents = _unique_documents(documents)
        sources, document_sources = _source_references(documents)
        context = _format_context(documents, document_sources)
        messages = self.answer_prompt.invoke(
            {"input": question, "chat_history": chat_history, "context": context}
        )
        return MedicalAnswerStream(
            chunks=self._answer_chunks(messages, question, context),
            sources=sources,
        )

    def _answer_chunks(self, messages, question: str, context: str) -> Iterator[str]:
        response_stream = self.chat_model.stream(messages)
        if self.review_enabled:
            draft = "".join(
                _text_content(response.content)
                for response in response_stream
            ).strip()
            if not draft:
                raise RuntimeError("The draft answer model returned an empty response")
            review_messages = self.review_prompt.invoke(
                {"input": question, "context": context, "draft": draft}
            )
            response_stream = self.review_model.stream(review_messages)

        for response in response_stream:
            content = _text_content(response.content)
            if content:
                yield content


def _tokens(value: str) -> list[str]:
    tokens = [token.casefold() for token in _TOKEN_PATTERN.findall(value)]
    meaningful = [token for token in tokens if token not in _STOP_WORDS and len(token) > 1]
    return meaningful or tokens


def _one_edit_apart(first: str, second: str) -> bool:
    if abs(len(first) - len(second)) > 1:
        return False
    if len(first) == len(second):
        return sum(left != right for left, right in zip(first, second)) <= 1
    shorter, longer = (first, second) if len(first) < len(second) else (second, first)
    index = offset = 0
    while index < len(shorter) and index + offset < len(longer):
        if shorter[index] == longer[index + offset]:
            index += 1
        elif offset:
            return False
        else:
            offset = 1
    return True


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


def _chat_messages(history: list[tuple[str, str]]) -> list[BaseMessage]:
    return [
        HumanMessage(content=content) if role == "user" else AIMessage(content=content)
        for role, content in history
    ]


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


def _source_references(documents: list[Document]) -> tuple[list[SourceReference], list[SourceReference]]:
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


def _text_content(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            str(item.get("text", "")) if isinstance(item, dict) else str(item)
            for item in content
        )
    return str(content)
