"""Download and verify a private lexical artifact during the Vercel build only."""

import hashlib
import os
import re
from collections.abc import Mapping
from pathlib import Path
from urllib.parse import urlparse

import httpx

from backend.data.lexical_artifact import (
    MAX_COMPRESSED_BYTES,
    LexicalArtifactError,
    validate_artifact,
)
from backend.paths import REPOSITORY_ROOT

ARTIFACT_PATH = REPOSITORY_ROOT / "backend/_artifacts/lexical-cache.json.gz"


def prepare_cache(environ: Mapping[str, str] | None = None, output: Path = ARTIFACT_PATH) -> dict:
    env = os.environ if environ is None else environ
    url = env.get("LEXICAL_CACHE_ARTIFACT_URL", "")
    digest = env.get("LEXICAL_CACHE_ARTIFACT_SHA256", "").lower()
    token = env.get("BLOB_READ_WRITE_TOKEN", "")
    parsed = urlparse(url)
    if (
        parsed.scheme != "https"
        or not re.fullmatch(r"[a-zA-Z0-9-]+\.private\.blob\.vercel-storage\.com", parsed.netloc)
        or parsed.query
        or parsed.fragment
    ):
        raise LexicalArtifactError(
            "Set LEXICAL_CACHE_ARTIFACT_URL to a private Vercel Blob HTTPS URL"
        )
    if not re.fullmatch(r"[0-9a-f]{64}", digest) or not token:
        raise LexicalArtifactError("Set LEXICAL_CACHE_ARTIFACT_SHA256 and BLOB_READ_WRITE_TOKEN")
    if env.get("LEXICAL_CACHE_PATH") != "backend/_artifacts/lexical-cache.json.gz":
        raise LexicalArtifactError(
            "Set LEXICAL_CACHE_PATH=backend/_artifacts/lexical-cache.json.gz"
        )
    # Never follow redirects with a storage credential or log private URLs/tokens.
    try:
        with httpx.stream(
            "GET",
            url,
            headers={"Authorization": f"Bearer {token}"},
            follow_redirects=False,
            timeout=60,
        ) as response:
            if response.status_code != 200:
                raise LexicalArtifactError(
                    f"Private cache download failed (HTTP {response.status_code})"
                )
            payload = bytearray()
            for part in response.iter_bytes():
                payload.extend(part)
                if len(payload) > MAX_COMPRESSED_BYTES:
                    raise LexicalArtifactError("Private cache exceeds compressed size limit")
    except httpx.HTTPError:
        raise LexicalArtifactError(
            "Private cache download failed; check Blob access and networking"
        ) from None
    if hashlib.sha256(payload).hexdigest() != digest:
        raise LexicalArtifactError("Private cache SHA256 differs from the pinned deployment value")
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".tmp")
    try:
        temporary.write_bytes(payload)
        manifest, _ = validate_artifact(
            temporary, int(env.get("CHUNK_SIZE", "1200")), int(env.get("CHUNK_OVERLAP", "180"))
        )
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)
    return manifest


def main() -> None:
    manifest = prepare_cache()
    print(
        f"Validated lexical cache: {manifest['document_count']} documents, {manifest['chunk_count']} chunks"
    )


if __name__ == "__main__":
    main()
