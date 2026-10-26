import os
from pathlib import Path
from zipfile import ZipFile

import pytest


def test_built_wheel_contains_only_supported_runtime_code():
    wheel = os.getenv("BUILT_WHEEL")
    if not wheel:
        pytest.skip("Build the wheel and set BUILT_WHEEL to validate its contents")
    with ZipFile(Path(wheel)) as archive:
        files = archive.namelist()
    assert "app.py" in files
    assert "store_index.py" in files
    assert "backend/services/rag/pipeline.py" in files
    assert "backend/integrations/openrouter.py" in files
    forbidden = {
        "legacy",
        "src",
        "tests",
        "research",
        "migrations",
        "Data",
        "frontend",
        ".cache",
        "__pycache__",
    }
    assert not any(forbidden.intersection(Path(name).parts) for name in files)
    assert not any(
        Path(name).name.startswith(".env") or name.lower().endswith(".pdf") for name in files
    )
