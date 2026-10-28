"""Inspect locally built Python Vercel functions before deploying them."""

import argparse
from pathlib import Path

from backend.data.lexical_artifact import validate_artifact


def check_bundle(directory: Path, chunk_size: int, overlap: int) -> list[tuple[str, int]]:
    functions = sorted(directory.rglob("*.func"))
    if not functions:
        raise ValueError("No .func directories found; run vercel build for the backend first")
    results = []
    forbidden_roots = {
        "Data",
        "frontend",
        "legacy",
        "research",
        "tests",
        "docs",
        "migrations",
        "image",
        ".github",
        ".cache",
        ".venv",
        ".pytest_cache",
        ".ruff_cache",
        ".benchmarks",
    }
    for function in functions:
        total = 0
        for path in function.rglob("*"):
            if not path.is_file():
                continue
            relative = path.relative_to(function)
            if (
                relative.parts[0] in forbidden_roots
                or path.name.startswith(".env")
                or path.suffix.lower() == ".pdf"
            ):
                raise ValueError(f"Forbidden deployment file: {relative}")
            total += path.stat().st_size
        if total > 500 * 1024 * 1024:
            raise ValueError("Python function exceeds the standard 500 MiB bundle limit")
        validate_artifact(
            function / "backend/_artifacts/lexical-cache.json.gz", chunk_size, overlap
        )
        results.append((function.name, total))
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, default=Path(".vercel/output/functions"))
    parser.add_argument("--chunk-size", type=int, default=1200)
    parser.add_argument("--chunk-overlap", type=int, default=180)
    args = parser.parse_args()
    for name, size in check_bundle(args.directory, args.chunk_size, args.chunk_overlap):
        print(f"{name}: {size / 1024 / 1024:.1f} MiB; lexical artifact verified")


if __name__ == "__main__":
    main()
