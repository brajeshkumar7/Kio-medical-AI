"""Export the current local PDF fingerprint's existing cache without embedding."""

import argparse
import hashlib
import json
import os
from pathlib import Path
from types import SimpleNamespace

from dotenv import load_dotenv

from backend.data.ingestion import _cache_path
from backend.data.lexical_artifact import export_artifact, validate_artifact
from backend.paths import DATA_DIR


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
    parser.add_argument("--output", type=Path, default=Path(".cache/lexical-v1.json.gz"))
    parser.add_argument("--chunk-size", type=int, default=int(os.getenv("CHUNK_SIZE", "1200")))
    parser.add_argument("--chunk-overlap", type=int, default=int(os.getenv("CHUNK_OVERLAP", "180")))
    args = parser.parse_args()
    settings = SimpleNamespace(chunk_size=args.chunk_size, chunk_overlap=args.chunk_overlap)
    cache = _cache_path(args.data_dir, settings)
    if not cache.is_file():
        parser.error(
            "No existing cache matches these PDFs and chunk settings; no PDFs were processed"
        )
    manifest = export_artifact(cache, args.output, args.chunk_size, args.chunk_overlap)
    validate_artifact(args.output, args.chunk_size, args.chunk_overlap)
    print(json.dumps(manifest, indent=2))
    print(f"Artifact: {args.output}")
    print(f"SHA256: {hashlib.sha256(args.output.read_bytes()).hexdigest()}")


if __name__ == "__main__":
    main()
