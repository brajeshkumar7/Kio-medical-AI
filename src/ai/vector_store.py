from pinecone import Pinecone, ServerlessSpec
from langchain_pinecone import PineconeVectorStore
from src.config.settings import Settings
from src.ai.embeddings import get_embeddings

class VectorStoreManager:
    def __init__(self):
        self.api_key = Settings.PINECONE_API_KEY
        self.index_name = Settings.PINECONE_INDEX_NAME
        self.dimension = Settings.EMBEDDING_DIMENSION
        self.embeddings = get_embeddings()
        
        # Initialize Pinecone Client
        self.pc = Pinecone(api_key=self.api_key)

    def init_index(self):
        """
        Creates the Pinecone index if it doesn't already exist.
        If it exists but has a different dimension, it recreates it to align with the new embedding dimension.
        """
        existing_indexes = [index.name for index in self.pc.list_indexes()]
        
        if self.index_name in existing_indexes:
            desc = self.pc.describe_index(self.index_name)
            if desc.dimension != self.dimension:
                print(f"[Pinecone] Warning: Index '{self.index_name}' exists but has dimension {desc.dimension}. Expected {self.dimension}.")
                print(f"[Pinecone] Deleting and recreating index '{self.index_name}' to align with the new embedding model...")
                self.pc.delete_index(self.index_name)
                self._create_index()
            else:
                print(f"[Pinecone] Index '{self.index_name}' already exists with correct dimensions ({self.dimension}).")
        else:
            print(f"[Pinecone] Index '{self.index_name}' does not exist. Creating now...")
            self._create_index()

    def _create_index(self):
        self.pc.create_index(
            name=self.index_name,
            dimension=self.dimension,
            metric="cosine",
            spec=ServerlessSpec(
                cloud="aws",
                region="us-east-1"
            )
        )
        print(f"[Pinecone] Successfully created serverless index '{self.index_name}'.")

    def get_vector_store(self) -> PineconeVectorStore:
        """
        Returns the PineconeVectorStore instance linked to the existing index.
        """
        return PineconeVectorStore.from_existing_index(
            index_name=self.index_name,
            embedding=self.embeddings
        )

    def save_documents(self, documents) -> PineconeVectorStore:
        """
        Embeds and saves the documents to Pinecone.
        """
        # Ensure index exists first with the correct configuration
        self.init_index()
        
        print(f"[Pinecone] Splitting, embedding, and uploading {len(documents)} chunks...")
        return PineconeVectorStore.from_documents(
            documents=documents,
            embedding=self.embeddings,
            index_name=self.index_name
        )
