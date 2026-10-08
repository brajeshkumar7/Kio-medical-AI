from src.utils.document_loader import load_pdf_data, split_text
from src.ai.vector_store import VectorStoreManager

def main():
    print("[Ingestion] Starting document ingestion pipeline...")
    
    # 1. Load document pages
    raw_docs = load_pdf_data()
    
    # 2. Split into text chunks
    chunks = split_text(raw_docs)
    
    # 3. Connect to Pinecone, provision/validate index dimensions, and upload embedded vectors
    vector_store_manager = VectorStoreManager()
    vector_store_manager.save_documents(chunks)
    
    print("[Ingestion] Ingestion pipeline successfully completed.")

if __name__ == "__main__":
    main()