from collections.abc import Iterator

from langchain.chains import create_history_aware_retriever
from langchain_core.documents import Document
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from backend.config import Settings
from backend.prompts.medical import CONTEXTUALIZE_PROMPT, EVIDENCE_REVIEW_PROMPT, SYSTEM_PROMPT

from .fusion import _fuse_documents, _unique_documents
from .lexical import LexicalMedicalIndex
from .sources import _format_context, _source_references
from .types import MedicalAnswer, MedicalAnswerStream


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
        self.retriever = create_history_aware_retriever(
            query_model, retriever, contextualize_prompt
        )
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
        self.review_prompt = ChatPromptTemplate.from_messages([("system", EVIDENCE_REVIEW_PROMPT)])
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
            draft = "".join(_text_content(response.content) for response in response_stream).strip()
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


def _chat_messages(history: list[tuple[str, str]]) -> list[BaseMessage]:
    return [
        HumanMessage(content=content) if role == "user" else AIMessage(content=content)
        for role, content in history
    ]


def _text_content(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            str(item.get("text", "")) if isinstance(item, dict) else str(item) for item in content
        )
    return str(content)
