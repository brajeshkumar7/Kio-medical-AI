from langchain_community.document_loaders import PyPDFLoader, DirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from src.config.settings import Settings

def load_pdf_data(data_dir: str = Settings.DATA_DIR):
    """
    Loads PDF files from a specified directory and extracts content.
    """
    print(f"[Loader] Loading documents from '{data_dir}'...")
    loader = DirectoryLoader(
        data_dir,
        glob="*.pdf",
        loader_cls=PyPDFLoader
    )
    documents = loader.load()
    print(f"[Loader] Successfully loaded {len(documents)} document pages.")
    return documents

def split_text(documents, chunk_size: int = Settings.CHUNK_SIZE, chunk_overlap: int = Settings.CHUNK_OVERLAP):
    """
    Splits document lists into smaller character chunks with overlap.
    """
    print(f"[Loader] Splitting documents (chunk_size={chunk_size}, overlap={chunk_overlap})...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )
    text_chunks = text_splitter.split_documents(documents)
    print(f"[Loader] Created {len(text_chunks)} text chunks.")
    return text_chunks
