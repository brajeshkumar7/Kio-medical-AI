"""Stable locations for the repository-based runtime and maintenance commands."""

from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = REPOSITORY_ROOT / "Data"
CACHE_DIR = REPOSITORY_ROOT / ".cache"
