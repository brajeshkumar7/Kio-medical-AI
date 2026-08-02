from langchain_core.documents import Document
from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableLambda

from backend.config import Settings
from backend.ai.openrouter import create_chat_model, create_review_model
from backend.services.rag import (
    LexicalMedicalIndex,
    MedicalQuestionAnswering,
    _source_references,
)


class FakeVectorStore:
    def __init__(self, documents):
        self.documents = documents
        self.search_type = None
        self.search_kwargs = None

    def as_retriever(self, *, search_type, search_kwargs):
        self.search_type = search_type
        self.search_kwargs = search_kwargs
        return RunnableLambda(lambda _query: self.documents)


def test_rag_returns_grounded_markdown_and_source_pages():
    documents = [
        Document(
            page_content="Seasonal allergies commonly cause sneezing, itching, and a runny nose.",
            metadata={"source": "Data/Medical_book.pdf", "page": 41},
        ),
        Document(
            page_content="Seek medical help when breathing becomes difficult.",
            metadata={"source": "Data/Medical_book.pdf", "page": 42},
        ),
    ]
    vector_store = FakeVectorStore(documents)
    model = RunnableLambda(
        lambda _messages, **_kwargs: AIMessage(
            content="Seasonal allergies often cause:\n\n- Sneezing [1]\n- An itchy or runny nose [1]\n\nSeek care for breathing trouble [2]."
        )
    )
    settings = Settings(pinecone_api_key="test", openrouter_api_key="test")

    result = MedicalQuestionAnswering(vector_store, model, settings).answer(
        "What are common symptoms of seasonal allergies?"
    )

    assert "- Sneezing [1]" in result.content
    assert [source.as_dict() for source in result.sources] == [
        {"id": 1, "title": "Gale Encyclopedia of Medicine, 2nd ed.", "page": 42},
        {"id": 2, "title": "Gale Encyclopedia of Medicine, 2nd ed.", "page": 43},
    ]
    assert vector_store.search_type == "mmr"
    assert vector_store.search_kwargs == {"k": 6, "fetch_k": 16, "lambda_mult": 0.65}


def test_rag_streams_without_changing_final_markdown():
    document = Document(
        page_content="A cough is a reflex that helps clear the airways.",
        metadata={"source": "Data/Medical_book.pdf", "page": 10},
    )
    vector_store = FakeVectorStore([document])
    model = RunnableLambda(
        lambda _messages, **_kwargs: AIMessage(content="A cough clears the airways [1].")
    )
    settings = Settings(pinecone_api_key="test", openrouter_api_key="test")

    result = MedicalQuestionAnswering(vector_store, model, settings).stream_answer(
        "What is a cough?"
    )

    assert "".join(result.chunks) == "A cough clears the airways [1]."
    assert result.metadata["sources"][0]["page"] == 11


def test_answer_model_disables_exposed_reasoning():
    settings = Settings(pinecone_api_key="test", openrouter_api_key="test")
    model = create_chat_model(settings)
    reviewer = create_review_model(settings)

    assert model.extra_body == {"reasoning": {"effort": "none", "exclude": True}}
    assert reviewer.model_name == "nvidia/nemotron-3-ultra-550b-a55b:free"
    assert reviewer.extra_body == {"reasoning": {"effort": "none", "exclude": True}}


def test_evidence_review_replaces_unsupported_draft_before_streaming():
    document = Document(
        page_content="Seasonal allergic rhinitis commonly causes sneezing and a runny nose.",
        metadata={"source": "Data/Medical_book.pdf", "page": 5},
    )
    calls = []

    def answer_then_review(messages, **_kwargs):
        calls.append(messages)
        if len(calls) == 1:
            return AIMessage(content="Sneezing is common. Seek care after exactly three days [1].")
        return AIMessage(
            content=(
                "Common symptoms include sneezing and a runny nose [1]. "
                "The current source does not specify when to seek care."
            )
        )

    model = RunnableLambda(answer_then_review)
    settings = Settings(pinecone_api_key="test", openrouter_api_key="test")
    result = MedicalQuestionAnswering(FakeVectorStore([document]), model, settings).answer(
        "What are the symptoms, and when should I seek care?"
    )

    assert len(calls) == 2
    assert "exactly three days" not in result.content
    assert "does not specify when to seek care" in result.content


def test_lexical_retrieval_finds_definition_missed_by_semantic_results():
    incidental = Document(
        page_content="A scalp fungus is similar to fungi that cause athlete's foot and ringworm.",
        metadata={"source": "Data/Medical_book.pdf", "page": 138},
    )
    definition = Document(
        page_content="Ringworm - A fungal infection of the skin, usually known as tinea corporis.",
        metadata={"source": "Data/Medical_book.pdf", "page": 139},
    )
    athlete_foot = Document(
        page_content="Athlete's foot is also known as tinea pedis or foot ringworm.",
        metadata={"source": "Data/Medical_book.pdf", "page": 411},
    )

    matches = LexicalMedicalIndex([incidental, definition, athlete_foot]).search(
        "What is ringworm?",
        k=2,
    )

    assert definition in matches
    assert matches[0] == definition


def test_hybrid_context_includes_exact_definition_and_source_page():
    incidental = Document(
        page_content="A scalp fungus can resemble fungi that cause ringworm.",
        metadata={"source": "Data/Medical_book.pdf", "page": 138},
    )
    definition = Document(
        page_content="Ringworm is a fungal infection of the skin called tinea corporis.",
        metadata={"source": "Data/Medical_book.pdf", "page": 139},
    )
    seen_prompts = []

    def answer_from_context(messages, **_kwargs):
        seen_prompts.append(messages.to_string())
        return AIMessage(content="Ringworm is a fungal skin infection [2].")

    settings = Settings(pinecone_api_key="test", openrouter_api_key="test")
    result = MedicalQuestionAnswering(
        FakeVectorStore([incidental]),
        RunnableLambda(answer_from_context),
        settings,
        lexical_documents=[incidental, definition],
    ).answer("What is ringworm?")

    assert all("tinea corporis" in prompt for prompt in seen_prompts)
    assert any(source.page == 140 for source in result.sources)


def test_source_references_normalize_windows_and_posix_paths():
    documents = [
        Document(page_content="first", metadata={"source": "Data\\Medical_book.pdf", "page": 139}),
        Document(page_content="second", metadata={"source": "Data/Medical_book.pdf", "page": 139}),
    ]

    sources, document_sources = _source_references(documents)

    assert len(sources) == 1
    assert document_sources == [sources[0], sources[0]]
