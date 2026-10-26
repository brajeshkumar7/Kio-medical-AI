import math
import re
from collections import Counter
from pathlib import Path

from langchain_core.documents import Document

_TOKEN_PATTERN = re.compile(r"[^\W_]+", re.UNICODE)


_STOP_WORDS = {
    "a",
    "about",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "can",
    "define",
    "describe",
    "do",
    "does",
    "explain",
    "for",
    "from",
    "how",
    "i",
    "in",
    "is",
    "it",
    "me",
    "of",
    "on",
    "or",
    "please",
    "tell",
    "the",
    "this",
    "to",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "with",
}


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

    def search(self, query: str, *, k: int) -> list[Document]:
        query_terms = list(dict.fromkeys(_tokens(query)))
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


def _tokens(value: str) -> list[str]:
    tokens = [token.casefold() for token in _TOKEN_PATTERN.findall(value)]
    meaningful = [token for token in tokens if token not in _STOP_WORDS and len(token) > 1]
    return meaningful or tokens
