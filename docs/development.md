# Development and verification

Run backend commands from the repository root with Python 3.11. Frontend CI uses
Node 24. Backend `.env` and `frontend/.env.local` stay separate; copy examples
only on first setup and preserve existing values.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements/development.txt -e .
.\.venv\Scripts\python.exe app.py
```

In a separate terminal, run `npm ci` and `npm run dev` from `frontend/`.

## Checks

```powershell
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m ruff format --check .
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m build
$env:BUILT_WHEEL = 'dist/medical_chatbot_genai-0.1.0-py3-none-any.whl'
.\.venv\Scripts\python.exe -m pytest tests/unit/test_distribution.py
```

From `frontend/`, run `npm run lint`, `npm run typecheck`, `npm test` and
`npm run build`. Development retains Webpack and production retains the existing
default bundler. Frontend source, styles, logo animation and assets are unchanged.

Ordinary tests mock providers. Golden fixtures capture the previous routes,
PostgreSQL DDL, retrieval ranking, source/context formatting and prompt values.
Do not regenerate fixtures simply to silence a behavior difference.

SQLite is used for isolated service tests and metadata creation. Historical
migration revisions use PostgreSQL-specific types and ALTER operations; this
refactor does not rewrite them for SQLite. For real migration tests, set
`TEST_POSTGRES_URL` to an empty disposable PostgreSQL database ending in `_test`.
Never use the application database. The test upgrades, downgrades, upgrades again
and cleans up. CI provisions an isolated PostgreSQL 16 service.

## Maintenance

```powershell
python store_index.py --help
python store_index.py --batch-size 32
python -m backend.jobs.purge_guests
python -m backend.jobs.evaluate_safety --help
```

Indexing makes embedding calls and writes to Pinecone. `--recreate` deletes the
configured index before rebuilding it. Guest cleanup deletes expired data and
needs only `DATABASE_URL`; never use it as a smoke test against live data.
Safety evaluation makes paid synthetic calls and remains an explicit staging
task. See [safety.md](safety.md) and [dependency locks](../requirements/README.md).
CI performs no live classification, embedding or Pinecone deletion.
