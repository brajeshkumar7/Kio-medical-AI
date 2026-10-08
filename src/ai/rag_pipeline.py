from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from src.ai.llm import get_llm
from src.ai.prompts import get_rag_prompt
from src.ai.vector_store import VectorStoreManager

def create_rag_chain():
    """
    Constructs and returns the full RAG pipeline.
    """
    # 1. Initialize components
    llm = get_llm()
    prompt = get_rag_prompt()
    
    # Connect to vector store
    vector_store_manager = VectorStoreManager()
    vector_store = vector_store_manager.get_vector_store()
    
    # 2. Setup retriever
    retriever = vector_store.as_retriever(
        search_type="similarity",
        search_kwargs={"k": 3}
    )
    
    # 3. Combine retrieved documents into the context prompt for LLM
    question_answer_chain = create_stuff_documents_chain(llm, prompt)
    
    # 4. Integrate retriever and Q&A chain into a single RAG pipeline
    rag_chain = create_retrieval_chain(retriever, question_answer_chain)
    
    return rag_chain
