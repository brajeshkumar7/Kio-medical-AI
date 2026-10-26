"""Compatible indexing entry point; implementation lives in backend.jobs."""

from backend.jobs.index_documents import build_index as build_index
from backend.jobs.index_documents import main

if __name__ == "__main__":
    main()
