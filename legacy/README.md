# Archived backend

`src/` is the previous implementation, preserved without source edits for
reference. The supported runtime is `backend/`, started through root `app.py`.

This directory is excluded from production packaging, test discovery, formatting,
and linting. Do not add it to PYTHONPATH or deploy its entry points. Its routes,
configuration, prompts, model choices, and index-management behavior differ from
the active backend. It is not a compatibility layer.
