# Repository architecture

The supported runtime is the Flask `backend/` package and the separate Next.js
`frontend/`. The Python distribution remains `medical-chatbot-genai` 0.1.0.
Backend CI covers Python 3.11 and 3.12; Vercel selects Python 3.12.
Frontend CI and Vercel use Node 24.

| Location | Responsibility |
| --- | --- |
| `app.py`, `backend/web.py` | Compatible entry point, application factory, extension/service wiring |
| `backend/config.py`, `backend/paths.py` | Existing settings, validation, repository data/cache locations |
| `backend/api/` | Account/guest routes, shared serialization, NDJSON helpers, public errors |
| `backend/auth.py` | Clerk authentication |
| `backend/models.py`, `extensions.py`, `repositories/` | Unchanged schema, database extensions, persistence |
| `backend/services/` | Conversation memory, guest identity/quota/retention/transfer, safety |
| `backend/services/rag/` | Lazy initialization, QA pipeline, lexical scoring, fusion, source formatting, result types |
| `backend/integrations/` | OpenRouter factories and Pinecone integration |
| `backend/prompts/` | Existing medical prompts, unchanged in value |
| `backend/data/` | PDF loading, splitting, local caches and portable lexical artifacts |
| `backend/jobs/` | Indexing, retention, safety evaluation, artifact export and deployment checks |
| `frontend/` | Existing feature-based Next.js application and its tests |
| `tests/unit/`, `tests/integration/` | Isolated logic checks and endpoint/database checks |
| `tests/fixtures/`, `tests/evaluation/` | Golden parity fixtures and synthetic safety corpus |
| `migrations/` | Unchanged PostgreSQL migration revisions |
| `legacy/src/`, `research/` | Archived backend and notebooks, excluded from production packaging |

Handlers call services; services use repositories and provider adapters. Guest
routes share API helpers without importing account handlers. Small cohesive
modules remain together. `services/contracts.py` provides structural typing for
injected services without runtime checks. `backend.services.rag` retains the
existing public class imports and source-reference helper used by tests.

## Preserved behavior

Ownership checks, transaction order, error text, UTC quotas, retention, transfer,
safety gates and streaming event values are unchanged. RAG retains query
rewriting, MMR settings, lexical scoring, neighbor selection, fusion weights,
deduplication, page conversion, source numbering and evidence review. The root
indexing wrapper keeps its flags, dimension detection, batching and explicit
recreation behavior.

## Data and paths

`Data/` stays at the repository root and is excluded from Git and Python
artifacts. The application still needs its source library or corresponding
chunk cache for lexical retrieval; Pinecone does not replace those local inputs.
Provision the PDF library on conventional hosts. On Vercel, export the matching
local chunk cache and download its private versioned artifact during the build.
`LEXICAL_CACHE_PATH` selects read-only artifact loading without PDF access or
runtime cache writes. Artifact failures stop retrieval initialization rather
than silently disabling lexical retrieval. See the
[Vercel guide](vercel-deployment.md) for commands and environment settings.

Default chunks stay in `.cache/medical-chunks-<fingerprint>.json.gz`. Fingerprint
inputs remain file names, sizes, modification times, chunk settings and version.
The generic ingestion loader retains dataset-relative cache placement for
explicitly supplied directories and tests. No migration, index recreation,
re-embedding, cache reset or environment-value change is part of this refactor.
