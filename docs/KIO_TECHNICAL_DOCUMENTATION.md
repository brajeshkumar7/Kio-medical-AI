# KIO Medical AI: Technical Architecture and Operations Guide

> As-built documentation derived from the repository on 2 August 2026.

## Document Scope

This guide documents the application currently implemented in this repository. It is intended for engineers who need to understand, run, test, extend, or deploy KIO. Statements about behavior describe the source code, not planned features. Secrets are intentionally omitted.

**Application name:** KIO Medical AI
**Core purpose:** KIO is a public medical-AI product site and an authenticated, evidence-grounded conversational assistant. It retrieves passages from a local medical reference corpus, generates reviewed answers through OpenRouter, and persists each user's conversation history in PostgreSQL.

---

## 1. Executive Summary and Architecture Overview

### 1.1 Product Overview

KIO has three user-facing areas:

1. A public, responsive landing page describing the product.
2. Clerk-hosted sign-in and sign-up experiences embedded in a KIO-branded shell.
3. A protected chat console with durable history, conversation search and deletion, progressive answer rendering, citations, dictation, theme selection, and responsive sidebar behavior.

The assistant is a retrieval-augmented generation (RAG) system. It does not train a medical model. Instead, it retrieves relevant excerpts from an indexed PDF, gives those excerpts to an answer model, and optionally passes the draft through a second evidence-review model before returning it to the browser.

### 1.2 Architectural Pattern

KIO is a **modular monolith split into two deployable web applications**, plus managed external services:

- The **Next.js frontend** owns presentation, browser interaction, Clerk session acquisition, and calls to the backend.
- The **Flask backend** is a layered API monolith. It owns authorization, conversation persistence, ingestion configuration, retrieval, answer generation, and streaming.
- **PostgreSQL**, **Pinecone**, **Clerk**, and **OpenRouter** are managed service dependencies.

This is not a microservices architecture: backend modules run in one Flask process and share one SQLAlchemy session and configuration object. The frontend and backend can nevertheless be deployed independently.

```text
Browser
  |
  | HTTPS: Next pages, Clerk session, REST/NDJSON API calls
  v
Next.js 16 frontend ----------------------> Clerk
  |                                         | issues RS256 JWT
  | Bearer JWT                              | publishes JWKS
  v                                         v
Flask API ----> Clerk JWKS verification
  |
  +----> PostgreSQL: users, conversations, messages
  |
  +----> RAG service
          +----> OpenRouter embedding API
          +----> Pinecone semantic MMR retrieval
          +----> local cached lexical index over Data/*.pdf
          +----> OpenRouter answer model
          +----> OpenRouter evidence-review model
```

### 1.3 Backend Layers

| Layer | Location | Responsibility |
|---|---|---|
| Entry point and composition | `app.py`, `backend/web.py` | Build the Flask application and wire dependencies. |
| Configuration | `backend/config.py` | Load and validate environment variables into an immutable settings object. |
| API transport | `backend/api/` | Validate HTTP input, serialize resources, and stream NDJSON events. |
| Authentication | `backend/auth.py` | Verify Clerk bearer tokens and expose the authenticated Clerk user ID. |
| Services | `backend/services/` | Coordinate conversation memory and the RAG answer lifecycle. |
| Repositories | `backend/repositories/` | Encapsulate user-scoped SQL queries and persistence operations. |
| Domain persistence | `backend/models.py` | Define users, conversations, messages, constraints, and relationships. |
| AI adapters | `backend/ai/` | Construct OpenRouter-compatible chat and embedding clients and prompts. |
| Data/vector adapters | `backend/data/`, `backend/vector_store.py` | Load/chunk PDFs, cache chunks, and manage Pinecone access. |

### 1.4 Frontend Composition

The frontend uses the Next.js App Router. `/` is public, `/sign-in` and `/sign-up` are public Clerk routes, and `/console` is protected by Clerk middleware. Client components provide theme state, toast notifications, chat orchestration, speech recognition, Markdown rendering, and Canvas/SVG branding.

### 1.5 Data Ownership

- Clerk is the identity source of truth. KIO stores only the Clerk subject identifier in its `users` table.
- PostgreSQL is the source of truth for conversation history.
- Pinecone stores vectorized document chunks for semantic retrieval.
- The local `Data/Medical_book.pdf` file and its generated gzip chunk cache support lexical retrieval.
- Browser `localStorage` stores only UI preferences (`kio-theme` and `kio-sidebar-collapsed`).

---

## 2. Comprehensive Technology Stack

### 2.1 Languages and Web Standards

| Technology | What it is | How KIO uses it | Why it fits |
|---|---|---|---|
| Python 3.11 | A general-purpose language commonly used for APIs and AI systems. | Implements the backend, indexing CLI, migrations, and tests. | It has mature Flask, LangChain, Pinecone, PDF, and database ecosystems. |
| TypeScript 5.7 | JavaScript with static types. | Implements all frontend application and component logic under `frontend/`. Strict mode and `noEmit` are enabled. | Strong types protect API contracts and complex UI state during refactoring. |
| JavaScript / ECMAScript | The browser and Node.js runtime language. | Executes compiled frontend code; CommonJS config is used in `next.config.js`. | It is the native runtime for React and Next.js. |
| HTML5 | Semantic web markup and accessibility primitives. | Next.js components render headings, navigation, forms, dialogs, tables, buttons, and status regions. | Native semantics improve accessibility and browser behavior. |
| CSS and Tailwind CSS | CSS is the browser styling language; Tailwind is a utility-first CSS framework. | Tailwind utilities are prominent on the landing page, while `app/globals.css` contains shared tokens and detailed application/auth/chat styles. | Utilities speed responsive composition; shared CSS variables keep light/dark themes consistent. |
| SVG and Canvas 2D | Browser-native vector and immediate-mode graphics APIs. | SVG renders the theme-aware KIO mark and auth care signal; Canvas animates the agent/loading mark. | Both are dependency-free, scalable, and efficient for branded motion. |
| Fetch, Streams, and NDJSON | Browser HTTP and incremental stream standards; NDJSON is one JSON object per line. | The frontend reads a streamed response with `ReadableStream`, `TextDecoder`, and line parsing. Flask emits `start`, `delta`, `complete`, and `error` events. | This provides progressive output without WebSocket infrastructure. |
| Web Speech API | A browser speech-recognition interface. | The console uses `SpeechRecognition` or `webkitSpeechRecognition` for interim and final dictation in the browser's locale. | It adds lightweight dictation without another backend service, with browser support as the tradeoff. |

### 2.2 Frontend Frameworks and Direct Libraries

| Technology | What it is | How KIO uses it | Why it fits |
|---|---|---|---|
| Node.js and npm | JavaScript runtime and package manager. | Install dependencies, run Next development/build servers, and consume `package-lock.json`. | They are the standard Next.js toolchain and the lockfile supports repeatable installs. |
| Next.js 16.2 | React framework with routing, server rendering, optimization, and build tooling. | App Router pages define landing, auth, loading, and console routes. `proxy.ts` applies Clerk protection. `next/image` optimizes landing assets. | It combines routing, production builds, server rendering, and React integration in one framework. |
| React 19 | Component-based UI library. | Client components manage chat, theme, toasts, auth rendering, animation, and speech state using hooks and context. | It suits a highly interactive single-page workspace and reusable component architecture. |
| React DOM 19 | React's browser renderer. | Hydrates and updates the Next.js UI. | Required to render React in the browser. |
| `@clerk/nextjs` 6.31 | Clerk's Next.js authentication SDK. | Provides `ClerkProvider`, middleware protection, `SignIn`, `SignUp`, `useAuth`, `useUser`, and `useClerk`. | It supplies password and social login, session management, and frontend JWT retrieval without custom credential handling. |
| `lucide-react` 0.468 | Tree-shakeable React icon library. | Supplies navigation, medical, status, theme, dictation, send, and account icons. | It provides a consistent accessible icon language with low custom SVG maintenance. |
| `react-markdown` 10.1 | Safe React renderer for Markdown. | Renders assistant headings, lists, links, images, and tables; raw HTML is skipped. | Model output remains structured while untrusted HTML is not executed. |
| `remark-gfm` 4.0 | GitHub Flavored Markdown plugin. | Adds table, strikethrough, task-list, and other GFM parsing support. | Medical comparisons can be rendered as readable tables. |
| Tailwind CSS 4.3 | Utility-first CSS compiler. | Compiles utility classes used in the landing experience. | Enables responsive design while reusing CSS custom properties as design tokens. |
| `@tailwindcss/postcss` 4.3 and PostCSS 8.5 | Tailwind's PostCSS adapter and CSS transformation pipeline. | `postcss.config.mjs` activates Tailwind during Next builds. | This is the supported Tailwind 4 integration for the existing build. |
| Type packages (`@types/node`, `@types/react`, `@types/react-dom`) | TypeScript declaration packages. | Supply compiler types for Node, React, and DOM rendering APIs. | They make strict TypeScript compilation possible. |
| Sharp override | Native image-processing library used by Next.js. | `package.json` pins a modern Sharp version through npm overrides. | Supports optimized production image handling and avoids incompatible transitive versions. |

### 2.3 Backend Frameworks and Direct Libraries

| Technology | What it is | How KIO uses it | Why it fits |
|---|---|---|---|
| Flask 3.1 | Lightweight Python WSGI web framework. | The app factory creates the API, registers routes/extensions, and exposes `/health`. | Its explicit composition model works well for a focused API and AI orchestration service. |
| Flask-CORS 5 | Cross-Origin Resource Sharing extension for Flask. | Allows configured frontend origins to call `/api/*` with authorization and JSON headers. | Frontend and backend run on separate origins locally and in production. |
| Flask-SQLAlchemy 3.1 | Flask integration for SQLAlchemy. | Owns the scoped database session and initializes declarative models. | It reduces Flask lifecycle boilerplate while retaining SQLAlchemy's ORM and query APIs. |
| SQLAlchemy 2.x | Python ORM and SQL toolkit. | Defines typed models, relationships, indexes, row locks, constraints, and repository queries. | It provides database portability in tests and robust PostgreSQL behavior in production. |
| Flask-Migrate 4 | Flask integration for Alembic migrations. | Registers the `flask db` commands and applies the schema under `migrations/`. | Versioned migrations make schema changes reviewable and repeatable. |
| Alembic | SQLAlchemy's schema migration engine. | Revision `20260801_0001` creates the user, conversation, and message schema. | It supports transactional PostgreSQL DDL and upgrade/downgrade history. |
| Psycopg 3 (`psycopg[binary]`) | PostgreSQL driver for Python. | SQLAlchemy URLs are normalized to `postgresql+psycopg://`; the binary package supplies the local driver. | It is a current, supported PostgreSQL adapter with straightforward deployment. |
| PyJWT with crypto extras | JWT implementation with asymmetric-signature support. | Retrieves Clerk JWKS keys and verifies RS256 signature, issuer, required claims, expiration, and authorized party. | It lets the API independently validate Clerk sessions without calling Clerk for every request. |
| Gunicorn 23 | Production WSGI process server. | The documented production command is `gunicorn app:app`. | Flask's development server is not suitable for production; Gunicorn provides managed workers. |
| python-dotenv | `.env` loader. | `Settings.from_env()` loads root development configuration. | It keeps local configuration separate from source code. Production should inject environment variables directly. |
| Pytest | Python testing framework, used by files under `tests/`. | Fixtures exercise API auth/ownership/streaming and unit tests exercise retrieval, citations, prompts, and model configuration. | Its fixtures and concise assertions fit service and Flask client tests. It should be added as an explicit dev dependency because it is not pinned in `requirements.txt`. |
| Editable package install (setuptools) | Python packaging/build tooling. | `setup.py` names `medical-chatbot-genai`; `-e .` installs repository modules during dependency setup. | Editable installs keep local imports stable during development. Runtime dependencies remain in `requirements.txt`. |

### 2.4 AI, Retrieval, and Document Libraries

| Technology | What it is | How KIO uses it | Why it fits |
|---|---|---|---|
| LangChain 0.3 | Framework for composing model, prompt, document, and retriever interfaces. | Creates a history-aware retriever and standardizes model/document/message abstractions. | It connects OpenAI-compatible models and Pinecone while keeping adapters replaceable. |
| `langchain-core` | LangChain's base interfaces and runnable primitives. | Supplies `Document`, prompts, chat messages, and test runnables. | Keeps application code against shared interfaces instead of vendor-specific response types. |
| `langchain-community` | Community data integrations. | `DirectoryLoader` and `PyPDFLoader` load all `Data/*.pdf` files. | Reuses maintained PDF ingestion adapters. |
| `langchain-openai` | LangChain adapter for OpenAI-compatible APIs. | `ChatOpenAI` and `OpenAIEmbeddings` target OpenRouter's `/api/v1` base URL. | OpenRouter exposes an OpenAI-compatible protocol, so no custom HTTP model client is needed. |
| `langchain-pinecone` 0.2.3 | Pinecone vector-store adapter. | Adds embedded chunks and exposes the MMR retriever used at query time. | It bridges LangChain documents directly to the managed vector index. |
| `langchain-text-splitters` | Text chunking package. | `RecursiveCharacterTextSplitter` creates overlapping 1,200-character chunks by default. | Recursive boundaries preserve readable passages while overlap protects facts near chunk edges. |
| Pinecone Python SDK 5.4 | Client for Pinecone's managed vector database. | Creates, deletes, checks, and waits for the serverless cosine index in AWS `us-east-1`. | Managed vector search avoids operating a similarity-search cluster. |
| PyPDF 5 | PDF parsing library. | Used under the LangChain PDF loader to extract source pages. | It is a pure-Python, mature PDF text extraction dependency. |
| NumPy 1.26 | Numerical array library. | Installed as part of the AI/vector dependency stack. No application module directly calls it. | It supports compatible numerical operations required by upstream libraries. |
| aiohttp 3.10 | Asynchronous HTTP client. | Pinned for compatibility in the AI/network dependency stack; application code does not import it directly. | It provides the transport expected by transitive integrations while controlling version drift. |
| OpenRouter | Hosted gateway exposing multiple models through an OpenAI-compatible API. | Routes embedding, drafting, evidence review, and the separately constructed safety classifier. It receives `HTTP-Referer` and `X-Title` headers. | A single API contract permits model selection through environment variables. |
| NVIDIA Nemotron 3 Nano | Configurable default chat model (`nvidia/nemotron-3-nano-30b-a3b:free`). | Rewrites follow-up questions for retrieval and generates the initial evidence-grounded draft. | It is selected as a low-cost general generation model. Model availability and free-tier limits are external operational risks. |
| NVIDIA Nemotron 3 Ultra | Configurable review model (`nvidia/nemotron-3-ultra-550b-a55b:free`). | Audits the draft against retrieved excerpts and streams the corrected response. | A second deterministic pass reduces unsupported claims and citation errors. It increases latency and provider usage. |
| NVIDIA Llama Nemotron Embed VL 1B v2 | Multimodal-capable embedding model exposed by OpenRouter. | Embeds source chunks and questions using string input and float encoding. | It gives semantic retrieval through the same gateway. The Pinecone index dimension is discovered from a real embedding at build time. |
| NVIDIA Nemotron Content Safety | Safety classification model. | `create_safety_model()` constructs a dedicated classifier, but no current request path invokes it. | Separating classification from answer generation is correct; however, moderation is presently reserved, not enforced. |
| Custom lexical index | In-memory BM25-style keyword scorer implemented in `rag.py`. | Scores local cached chunks, normalizes simple typos/plurals, favors definition passages, and adds neighboring chunks. | It recovers exact medical terms that semantic retrieval may miss without adding another search service. |
| Reciprocal rank fusion | Rank-combination algorithm. | Merges semantic results (weight 1.0) and lexical results (weight 1.25), then keeps the configured context limit. | It combines complementary retrieval signals without requiring scores to share a scale. |

### 2.5 Data Stores and Managed Services

| Technology | What it is | How KIO uses it | Why it fits |
|---|---|---|---|
| PostgreSQL (Render) | Transactional relational database. | Stores application users, conversations, ordered messages, timestamps, summaries, and JSON/JSONB metadata. | Relational constraints, transactions, indexing, and durable history fit account-owned conversations. Render provides managed operations and an internal service URL. |
| Pinecone Serverless | Managed vector database. | Stores document embeddings in a cosine index and returns diverse semantic results with maximum marginal relevance (MMR). | It scales similarity search independently of the API and avoids local vector infrastructure. |
| Clerk | Managed identity and authentication platform. | Hosts email/password and configured social authentication, maintains browser sessions, issues JWTs, and publishes JWKS. | It avoids storing passwords and implementing OAuth provider flows in KIO. |
| Local gzip JSON cache | Fingerprinted on-disk cache under `.cache/`. | Stores extracted/chunked PDF text and metadata for fast lexical index startup. | PDF parsing is avoided when source files and chunk settings have not changed. |
| Browser localStorage | Per-browser key/value storage. | Persists theme and sidebar-collapse preferences only. | These are low-risk UI preferences that do not require server persistence. |

**Not present:** Redis, a message broker, a background worker, object storage, Docker, Kubernetes, Terraform, and a repository CI/CD workflow are not implemented. Redis should be added only when distributed rate limiting, shared caching, queues, or background jobs have a measured requirement.

### 2.6 Database Schema

| Table | Important columns and constraints | Relationships |
|---|---|---|
| `users` | UUID string PK; unique/indexed `clerk_user_id`; timezone-aware timestamps. | One user owns many conversations. |
| `conversations` | UUID string PK; FK `user_id`; title up to 160 characters; optional summary; indexed update time. | Cascades deletion to messages. Composite index supports recent history per user. |
| `messages` | UUID string PK; FK `conversation_id`; role check (`user` or `assistant`); text content; sequence; JSONB metadata; timestamp. | Unique `(conversation_id, sequence)` preserves ordering. Metadata currently carries cited sources. |

SQLite is used only in tests through SQLAlchemy's generic JSON variant. PostgreSQL uses native JSONB in the application schema.

### 2.7 Source Corpus

The checked-in corpus currently contains one 637-page file: `Data/Medical_book.pdf`. Its title pages identify it as *The Gale Encyclopedia of Medicine, Second Edition, Volume 1: A-B*. Responses use the shorter label *Gale Encyclopedia of Medicine, 2nd ed.* Page metadata is converted from PyPDF's zero-based page number to a one-based display number.

This corpus boundary is critical: direct encyclopedia entries are largely limited to topics alphabetized A through B, even though incidental references to later terms can occur. Retrieval quality cannot exceed the coverage, currency, extraction quality, and specificity of this source. The prompts intentionally make KIO state when evidence is missing rather than answer from model memory.

---

## 3. Methodologies and System Processes

### 3.1 Dependency Injection and Application Factory

**What it is:** Application factories create configured application instances instead of relying on hidden global initialization. Dependency injection allows real services to be replaced in tests.

**How KIO uses it:**

1. `app.py` calls `backend.web.create_app()`.
2. `create_app` loads one immutable `Settings` instance.
3. It configures SQLAlchemy, CORS, migrations, authentication, repositories, and conversation services.
4. The RAG service is wrapped in `LazyMedicalQuestionAnswering`, so startup and `/health` do not immediately contact Pinecone or OpenRouter.
5. Tests inject a fake authenticator and fake medical-QA service, then use an isolated SQLite database.

### 3.2 Layered Repository and Service Pattern

**What it is:** Transport, business orchestration, and persistence are kept in separate layers.

**How KIO uses it:**

1. API routes parse and validate HTTP requests.
2. `ConversationMemoryService` enforces workflow rules, creates titles, selects bounded history, and coordinates RAG.
3. `ConversationRepository` contains SQLAlchemy queries and persistence operations.
4. ORM models define storage constraints independently of API JSON.
5. User-scoped repository lookups prevent an authenticated user from reading another user's conversation.

This boundary is useful but not a formal domain-driven design implementation; entities are SQLAlchemy models and transaction control currently appears in both repository and service methods.

### 3.3 Configuration and Twelve-Factor Principles

**What it is:** Runtime configuration is externalized from code and processes are designed to be disposable.

**How KIO uses it:**

1. Local backend values are loaded from root `.env`.
2. Production values are expected from the hosting environment.
3. Required AI variables are always validated; database and Clerk variables are additionally required for application startup.
4. `store_index.py` calls `Settings.from_env(require_app_services=False)`, allowing indexing without PostgreSQL or Clerk.
5. Render-style `postgres://` and `postgresql://` URLs are normalized for Psycopg 3.
6. Frontend public configuration is compiled from `NEXT_PUBLIC_*` variables; Clerk's secret key remains server-only.

Never commit real secrets. Rotate any credential exposed in logs, screenshots, chat, or source control.

### 3.4 Clerk Authentication and Authorization

**What it is:** Clerk manages identity and OAuth/password flows; KIO performs JWT-based API authorization.

**How KIO uses it:**

1. Next middleware treats `/`, `/sign-in(.*)`, and `/sign-up(.*)` as public and calls `auth.protect()` for other matched routes.
2. Clerk components perform registration/sign-in and redirect successful users to `/console`.
3. The chat client calls `getToken()` before every backend operation.
4. It sends `Authorization: Bearer <token>`.
5. Flask's `@require_auth` decorator passes the header to `ClerkAuthenticator`.
6. PyJWT selects the signing key from `<issuer>/.well-known/jwks.json`, with key caching.
7. It verifies RS256, issuer, expiration, issued-at, subject, and the optional authorized-party claim.
8. The Clerk subject is stored in Flask `g` for that request.
9. The service resolves or creates the matching local user.
10. Every conversation query includes that local user ID; unauthorized IDs return 404 rather than exposing ownership.

KIO does not store passwords or OAuth tokens. CORS is not authorization; bearer-token verification and owner-scoped queries provide that boundary.

### 3.5 Document Ingestion and Index Versioning

**What it is:** Ingestion converts source documents into retrievable units and indexes their vector representations.

**How KIO uses it:**

1. `store_index.py` finds all PDFs under `Data/`.
2. `DirectoryLoader` delegates each PDF to `PyPDFLoader`, retaining source and page metadata.
3. `RecursiveCharacterTextSplitter` creates chunks using configured size and overlap; each receives a global `chunk_index`.
4. A cache fingerprint includes cache version, chunk settings, PDF name, file size, and nanosecond modification time.
5. Unchanged chunks load from `.cache/medical-chunks-<digest>.json.gz`; corrupt cache data is deleted and rebuilt.
6. The first chunk is embedded to verify the provider and discover vector dimension.
7. If the target index exists, the command refuses to overwrite it unless `--recreate` is supplied.
8. Pinecone creates a cosine, serverless index and is polled until ready.
9. Chunks are embedded and uploaded in configurable batches with progress output.

For production, prefer a new versioned index name, validate it, and switch `PINECONE_INDEX_NAME`. Deleting the live index with `--recreate` creates avoidable downtime.

### 3.6 Hybrid Retrieval Pipeline

**What it is:** Hybrid search combines semantic similarity with exact lexical matching.

**How KIO uses it:**

1. The last configured messages are converted to LangChain `HumanMessage` and `AIMessage` objects.
2. For follow-ups, the chat model rewrites the newest message into a standalone query while retaining the user's language.
3. Pinecone performs MMR retrieval: it fetches a larger candidate set, then balances relevance and diversity.
4. In parallel conceptually, the local lexical index tokenizes the original question, removes common stop words, normalizes basic plurals and known/close typos, and calculates a BM25-style score.
5. Definition-like passages receive a bonus; neighboring chunks from the same source are added around strong lexical results.
6. Weighted reciprocal rank fusion combines semantic and lexical rankings.
7. Duplicate passages are removed and results are limited by `RETRIEVAL_CONTEXT_K`.
8. Each unique source-page pair is assigned a stable response-local citation number.
9. The prompt receives normalized excerpts labeled `[1]`, `[2]`, and so on.

The lexical index is held in each backend process. Multiple Gunicorn workers duplicate this memory. The current typo correction is heuristic and vocabulary-based, not a general multilingual spell checker.

### 3.7 Grounded Generation and Evidence Review

**What it is:** Grounded generation constrains an LLM to retrieved evidence; a second model audits the first response.

**How KIO uses it:**

1. The system prompt requires a direct, plain-language answer in the user's language.
2. It prohibits invented facts, citations, thresholds, durations, treatment steps, and unsupported images.
3. The draft model runs at low temperature with hidden reasoning excluded.
4. When `ANSWER_REVIEW_ENABLED=true`, the entire draft is collected before any reviewed text is returned.
5. The review model receives the question, exact excerpts, and draft.
6. It removes unsupported claims, corrects evidence strength, normalizes citations, and preserves useful Markdown.
7. Only source entries whose numeric IDs appear in the final answer are persisted and exposed.
8. `MedicalAnswer` renders the Markdown; raw HTML is skipped and GFM tables are supported.

This design improves grounding but cannot guarantee clinical correctness. The reviewer is another probabilistic model, the source is old and narrow, and safety-model enforcement is not currently connected.

### 3.8 Progressive Response Streaming

**What it is:** Incremental transport lets the UI render answer text before the request closes.

**How KIO uses it:**

1. The browser posts to `/api/conversations/<id>/messages/stream`.
2. Flask immediately persists the user message and emits a `start` event.
3. RAG yields model text chunks as `delta` events.
4. The browser parses NDJSON safely across arbitrary network chunk boundaries.
5. A 32 ms presentation loop reveals a bounded number of characters, smoothing irregular provider chunks.
6. The animated KIO thinking indicator and elapsed timer remain visible while streaming.
7. Flask joins all chunks, persists one assistant message, and emits `complete` with canonical IDs and metadata.
8. The client replaces optimistic/temporary messages with the canonical records.

With evidence review enabled, there is an initial silent interval while the complete draft is generated. The text that then streams is the reviewer output. This is two-stage progressive rendering, not token streaming from the first model.

### 3.9 Conversation Memory and Transaction Process

**What it is:** Durable conversational memory saves exchanges and supplies recent turns to later retrieval and generation.

**How KIO uses it:**

1. The first submitted prompt creates a conversation and becomes its title, normalized to whitespace and truncated to 72 characters.
2. The service locks the owned conversation row with `SELECT ... FOR UPDATE` before sequencing a message.
3. The user message is committed before model execution, so the question survives an AI-provider failure.
4. Up to `HISTORY_MESSAGE_LIMIT` recent messages are passed to RAG; the default is 12.
5. After generation, the conversation is locked again, the assistant gets the next sequence number, and the transaction is committed.
6. Conversation `updated_at` moves it to the top of the recent list.
7. Deleting a conversation cascades to all messages.

A failed generation can therefore leave an unmatched user message. This is intentional durability but requires a future retry/status model if exact pair completion is required. The unique sequence constraint protects ordering; application-level locking protects concurrent writers on PostgreSQL.

### 3.10 Schema Migration Process

**What it is:** Database migrations evolve production schemas without recreating data.

**How KIO uses it:**

1. Models describe the target schema.
2. Alembic revision files under `migrations/versions/` encode upgrade and downgrade operations.
3. `python -m flask --app app db upgrade` connects through `DATABASE_URL` and applies pending revisions transactionally.
4. The initial revision creates all three tables, foreign keys, indexes, check constraints, JSONB defaults, and cascade behavior.
5. Production deployment should run the migration as a pre-deploy step before new application workers receive traffic.

### 3.11 Error Handling and User Feedback

**What it is:** Errors are translated at system boundaries and users receive non-blocking feedback.

**How KIO uses it:**

- Missing/invalid auth returns JSON 401; missing owned conversations return 404.
- Empty or over-8,000-character messages return 400.
- RAG start or execution failures are logged server-side and return/emit a generic 502-safe message.
- Stream errors become an NDJSON `error` event.
- The API client converts unsuccessful JSON responses into JavaScript `Error` objects.
- The UI displays timed, accessible toast notifications instead of browser alerts. Destructive deletion uses an asynchronous toast confirmation.
- Optimistic user messages are removed when sending fails.
- The public `/health` endpoint reports API process availability, not database, Pinecone, Clerk, or model readiness.

There is no structured logging, request ID, tracing, metrics backend, or centralized error service in the repository.

### 3.12 Frontend State, Theming, and Accessibility

**What it is:** Local React state and context coordinate UI behavior; token-based themes centralize visual state.

**How KIO uses it:**

- `KioThemeProvider` reads the saved preference or OS preference after mount, updates `data-theme`, and persists changes.
- CSS custom properties define semantic color tokens for application, landing, and auth surfaces.
- `ToastProvider` exposes `notify` and promise-based `confirm` APIs and announces updates with ARIA live regions.
- The sidebar, search modal, account menu, recent popover, dictation timeline, and composer use native buttons/forms and accessible labels.
- `prefers-reduced-motion` disables continuous Canvas animation where implemented.
- The animated loader observes element size and page visibility, caps device-pixel ratio, and cancels frames during cleanup.
- Auth forms delay Clerk rendering until client mount to prevent server/client hydration mismatch.
- Assistant Markdown links open with `noopener`; raw HTML is disabled.

### 3.13 Testing Strategy

**What it is:** Automated tests verify important behavior without external services.

**How KIO uses it:**

- Flask client tests cover authentication rejection, memory order, history use, owner isolation, deletion, validation, streaming events, persistence, and citation filtering.
- RAG unit tests use fake vector stores and runnable models to cover MMR configuration, page labels, streaming equivalence, evidence review, exact-term lexical retrieval, hybrid context, path normalization, and prompt rules.
- SQLite provides an isolated temporary database per backend test fixture.
- No frontend unit, component, accessibility, visual-regression, or end-to-end tests are currently checked in.
- No CI workflow runs tests or builds automatically.

### 3.14 Deployment and Release Method

**What it is:** The current release model is command-driven deployment rather than repository-defined CI/CD.

**How KIO uses it:**

- Backend production command: `gunicorn app:app`.
- Backend pre-deploy command: `python -m flask --app app db upgrade`.
- Frontend production lifecycle: `npm ci`, `npm run build`, then `npm run start` (or an equivalent managed Next host).
- Render PostgreSQL's internal URL should be used by a Render backend; its external URL is for local access.
- Frontend and backend origins must agree across `NEXT_PUBLIC_API_URL`, `FRONTEND_ORIGIN`, `CLERK_AUTHORIZED_PARTIES`, and Clerk settings.
- Pinecone indexing is a separate operator-run job and is not performed during API startup.

A production team should add CI gates, separate staging/production credentials and indexes, rollback procedures, dependency scanning, backups, monitoring, and deployment health checks.

### 3.15 Security, Privacy, and Clinical-Safety Posture

Implemented controls include Clerk identity, signed JWT verification, authorized-party checking, user-scoped queries, SQL parameters through SQLAlchemy, input length checks, restrictive CORS, no raw Markdown HTML, and secret externalization.

Important limitations:

- The UI contains privacy/HIPAA-oriented marketing language, but the repository does not prove HIPAA or SOC 2 compliance.
- Medical prompts and excerpts are sent to OpenRouter and may be sent to model providers selected by OpenRouter. Provider terms, retention, residency, and business-associate requirements must be reviewed before handling protected health information.
- PostgreSQL encryption, backups, audit logging, retention/deletion policy, consent, and breach procedures are hosting/operational responsibilities not encoded here.
- The safety classifier is not called in the active API flow.
- There is no rate limiter, abuse control, malware scan for attachments, or attachment upload backend. The paperclip is currently visual only.
- The source is educational and dated. KIO must not be represented as a diagnostic device or substitute for professional care without appropriate validation and regulatory work.

---

## 4. Step-by-Step Functional Workflows

### 4.1 Registration and Sign-In Flow

1. The user opens `/sign-up` or `/sign-in` in Next.js.
2. `AuthShell` renders KIO branding, theme controls, and the Clerk form.
3. Clerk performs email/password or configured social-provider authentication. Provider setup occurs in the Clerk dashboard, not in KIO code.
4. Clerk establishes the browser session and redirects to `/console`.
5. Next middleware verifies the protected route session.
6. `ChatWorkspace` waits for Clerk's client state, then calls `getToken()`.
7. The first API request sends the token to Flask.
8. Flask verifies it against Clerk JWKS and extracts `sub`.
9. `get_or_create_user` creates the PostgreSQL application-user row on first API use.
10. Existing conversations are returned in most-recently-updated order.

### 4.2 Initial Console and History Loading Flow

1. `/console` renders `ChatWorkspace`; route-level loading uses the animated KIO indicator.
2. Theme and sidebar preferences are restored from localStorage after mount.
3. Browser speech-recognition support is detected.
4. Once Clerk is loaded and signed in, the client requests `GET /api/conversations`.
5. Flask authenticates the request, resolves the local user, and queries at most 50 conversations.
6. The sidebar renders titles only; the user's email appears inside the account menu rather than the sidebar row.
7. Selecting a conversation requests `GET /api/conversations/<id>`.
8. The server owner-scopes the query and returns messages ordered by sequence.
9. Markdown assistant answers and source metadata are rendered; the view scrolls to the latest content.

### 4.3 New Message and RAG Answer Flow

1. The user types, selects a starter prompt, or accepts dictated text.
2. The frontend ignores blank input, prevents duplicate submission while loading, and creates a temporary user message with `crypto.randomUUID()`.
3. If no conversation is active, it posts to `POST /api/conversations` and records the returned conversation ID.
4. It posts the question to the stream endpoint with a Clerk bearer token.
5. Flask validates non-empty content and the 8,000-character limit.
6. The service locks the owned conversation, derives the title for a first message, stores the user message, and commits.
7. Recent message history is limited and converted to chat-model messages.
8. The history-aware model rewrites follow-up wording into a standalone retrieval query.
9. Pinecone MMR and the local lexical index retrieve candidates.
10. Rank fusion, neighbor expansion, deduplication, and context limiting produce labeled excerpts.
11. The draft model answers from those excerpts using the KIO system prompt.
12. If review is enabled, the reviewer audits the complete draft and streams corrected Markdown.
13. Flask emits NDJSON deltas; the browser progressively reveals them beside the animated thinking status.
14. Flask stores the final assistant message and only its cited source records, then emits `complete`.
15. The browser replaces temporary state with canonical records and moves the conversation to the top of Recents.

### 4.4 Follow-Up Question Flow

1. The user submits a reference-dependent message such as "What about its warning signs?"
2. The service supplies up to the last 12 persisted messages by default.
3. The contextualization prompt uses history only to resolve references and returns a standalone query.
4. Retrieval runs against the standalone semantic query; the custom lexical search currently receives the original question.
5. The answer prompt receives both bounded history and new excerpts.
6. The final user and assistant messages are appended with monotonically increasing sequence values.

### 4.5 Conversation Search and Deletion Flow

1. Search opens a client-side modal via the sidebar icon or `Ctrl/Cmd+K`.
2. The already-loaded recent list is filtered by case-insensitive title substring; no backend full-text search occurs.
3. Delete is available on the hovered conversation row or compact Recents popover.
4. A toast-based confirmation resolves to `true` or `false`.
5. On confirmation, the frontend sends `DELETE /api/conversations/<id>`.
6. The server verifies ownership and deletes the conversation; PostgreSQL cascades message deletion.
7. The frontend removes the row, resets the active view when necessary, and shows a success toast.

### 4.6 Dictation Flow

1. The microphone control is enabled only when the browser exposes Web Speech API and no answer is loading.
2. Recognition runs continuously with interim results in `navigator.language`.
3. The UI renders a live waveform-style timeline and transcription.
4. Cancel aborts recognition and discards captured speech.
5. Accept stops recognition and appends the transcript to any text that existed before dictation.
6. The transcript becomes editable input; it is not automatically submitted.
7. Permission errors are shown through the toast system.

### 4.7 Theme and Animation Flow

1. The root HTML initially renders with `data-theme="dark"` and hydration-warning suppression.
2. After mount, the provider chooses saved light/dark preference or the OS color scheme.
3. Toggling updates the root dataset and localStorage.
4. Shared semantic CSS variables recolor chat, auth, landing, logo, Markdown, and controls.
5. Canvas loaders size themselves from their container, react to visibility, and honor reduced-motion preferences.
6. The SVG logo derives all colors from theme variables rather than a fixed-background image.

### 4.8 Index Build and Application Startup Flow

1. An operator configures OpenRouter and Pinecone in root `.env`.
2. `python store_index.py --batch-size 32` loads/chunks/caches the PDFs and creates a new configured Pinecone index. Use `--recreate` only when destructive replacement is intended.
3. The operator configures PostgreSQL and Clerk and runs `python -m flask --app app db upgrade`.
4. Flask starts. It validates configuration but delays RAG network initialization.
5. Next.js starts with its Clerk and API URL variables.
6. `/health` can pass before Pinecone/OpenRouter readiness; the first question initializes embeddings, Pinecone, local lexical documents, and model clients under a process lock.

---

## 5. Local Setup and Execution

### 5.1 Prerequisites

- Python 3.11 (the documented baseline).
- Node.js version compatible with Next.js 16 and npm.
- A Clerk application with email/password and desired social providers enabled.
- A Render PostgreSQL database or another reachable PostgreSQL instance.
- Pinecone and OpenRouter accounts/API keys.
- PowerShell commands below assume Windows, matching the repository's current development environment.

### 5.2 Backend Environment

Create root `.env` from `.env.example` and supply real values. Do not add spaces around `=` and do not quote values unless the value itself requires it.

```dotenv
PINECONE_API_KEY=...
OPENROUTER_API_KEY=...
DATABASE_URL=postgresql://user:password@host:5432/database
CLERK_ISSUER_URL=https://your-instance.clerk.accounts.dev
CLERK_AUTHORIZED_PARTIES=http://localhost:3000
FRONTEND_ORIGIN=http://localhost:3000
PINECONE_INDEX_NAME=medicalbot-v2
OPENROUTER_CHAT_MODEL=nvidia/nemotron-3-nano-30b-a3b:free
OPENROUTER_REVIEW_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
OPENROUTER_SAFETY_MODEL=nvidia/nemotron-3.5-content-safety:free
OPENROUTER_EMBEDDING_MODEL=nvidia/llama-nemotron-embed-vl-1b-v2:free
```

Use Render's **external** database URL from a local machine and the **internal** URL from a backend deployed inside Render. `CLERK_ISSUER_URL` is Clerk's token `iss`/Frontend API origin, not the dashboard URL.

### 5.3 Backend Installation and Database

```powershell
cd 'C:\Users\ASUS\Desktop\Medical Chatbot\Medical-Chatbot-GenAI'
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m flask --app app db upgrade
```

A migration log ending after `Running upgrade -> 20260801_0001` without a traceback means the migration completed.

### 5.4 Build the Medical Index

For a new/versioned index:

```powershell
$env:PINECONE_INDEX_NAME='medicalbot-v3'
python store_index.py --batch-size 32
```

To deliberately delete and rebuild the configured index:

```powershell
python store_index.py --recreate --batch-size 32
```

Indexing can take time because each batch calls a hosted embedding model. Progress is printed for document loading, embedding verification, index creation, and every upload batch.

### 5.5 Start the Backend

```powershell
python app.py
```

Defaults: API `http://localhost:8080`; public readiness route `http://localhost:8080/health`.

### 5.6 Frontend Environment and Installation

The README refers to `frontend/.env.example`, but that file is not currently checked in. Create `frontend/.env.local` with:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

Then install and run:

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`. Use `/console` for the protected workspace.

### 5.7 Verification

```powershell
# From the repository root with the virtual environment active
python -m pytest

# From frontend/
npm run build
```

The configured `npm run lint` script calls `next lint`; verify this command against the installed Next.js 16 CLI before making it a CI gate. There are currently no frontend automated tests.

### 5.8 Production Commands

Backend pre-deploy:

```text
python -m flask --app app db upgrade
```

Backend start:

```text
gunicorn app:app
```

Frontend build/start:

```text
npm ci
npm run build
npm run start
```

Set `NEXT_PUBLIC_API_URL` before the frontend build because public Next variables are compiled into the browser bundle.

---

## 6. Configuration and API Reference

### 6.1 Backend Environment Variables

| Variable | Required/default | Responsibility |
|---|---|---|
| `PINECONE_API_KEY` | Required | Authenticates Pinecone administration and queries. |
| `OPENROUTER_API_KEY` | Required | Authenticates embedding and chat model calls. |
| `DATABASE_URL` | Required for app | PostgreSQL SQLAlchemy connection URL. |
| `CLERK_ISSUER_URL` | Required for app | Expected JWT issuer and base for the JWKS endpoint. |
| `CLERK_AUTHORIZED_PARTIES` | Frontend origin | Comma-separated accepted JWT `azp` values and CORS origins. |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | OpenRouter referer header and fallback authorized party. |
| `PINECONE_INDEX_NAME` | `medicalbot` | Active vector index. |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | OpenAI-compatible model endpoint. |
| `OPENROUTER_CHAT_MODEL` | Nemotron 3 Nano free | Contextualization and draft generation model. |
| `OPENROUTER_REVIEW_MODEL` | Nemotron 3 Ultra free | Evidence-review model. |
| `OPENROUTER_SAFETY_MODEL` | Nemotron Content Safety free | Reserved classifier configuration; not called by active routes. |
| `OPENROUTER_EMBEDDING_MODEL` | Llama Nemotron Embed VL free | Query and document embeddings. |
| `RETRIEVAL_K` | `6` | Semantic documents returned after MMR. |
| `RETRIEVAL_FETCH_K` | `16` | Semantic candidates considered by MMR. |
| `RETRIEVAL_LAMBDA_MULT` | `0.65` | MMR relevance/diversity balance. |
| `RETRIEVAL_LEXICAL_K` | `4` | Primary lexical matches before neighbor expansion. |
| `RETRIEVAL_CONTEXT_K` | `8` | Maximum fused documents passed to generation. |
| `CHUNK_SIZE` | `1200` | Recursive text chunk size in characters. |
| `CHUNK_OVERLAP` | `180` | Character overlap between neighboring chunks. |
| `ANSWER_MAX_TOKENS` | `1800` | Draft/review response token ceiling. |
| `ANSWER_REVIEW_ENABLED` | `true` | Enables the second evidence-audit pass. |
| `HISTORY_MESSAGE_LIMIT` | `12` | Recent persisted messages supplied as memory. |
| `FLASK_HOST` | `0.0.0.0` | Development server bind host. |
| `FLASK_PORT` | `8080` | Development server port. |
| `FLASK_DEBUG` | `false` | Flask debug mode; never enable in production. |

Changing the embedding model or chunk configuration requires a new/rebuilt Pinecone index. Changing only generation/review models does not.

### 6.2 Frontend Environment Variables

| Variable | Visibility | Responsibility |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Browser-public | Base URL for Flask requests; defaults to `http://localhost:8080`. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Browser-public | Identifies the Clerk frontend application. |
| `CLERK_SECRET_KEY` | Server-only | Enables Clerk's server-side Next integration. Never prefix with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Browser-public | Canonical sign-in route (`/sign-in`). |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Browser-public | Canonical sign-up route (`/sign-up`). |

### 6.3 HTTP API

All conversation routes require `Authorization: Bearer <Clerk JWT>`. JSON timestamps are UTC ISO 8601 strings. There is no public API version prefix beyond `/api`.

| Method and path | Purpose | Success | Important failures |
|---|---|---|---|
| `GET /health` | Process-level health response. | `200` with service/status JSON. | Does not verify dependencies. |
| `GET /api/conversations` | List up to 50 owned conversations. | `200`. | `401`. |
| `POST /api/conversations` | Create an empty owned conversation. | `201`. | `401`. |
| `GET /api/conversations/{id}` | Return an owned conversation and all ordered messages. | `200`. | `401`, `404`. |
| `DELETE /api/conversations/{id}` | Delete an owned conversation and messages. | `204`. | `401`, `404`. |
| `POST /api/conversations/{id}/messages` | Generate and persist a non-streamed answer. | `201`. | `400`, `401`, `404`, `502`. |
| `POST /api/conversations/{id}/messages/stream` | Generate an NDJSON answer stream and persist completion. | `200` stream. | HTTP errors before start; `error` event after start. |

Message request:

```json
{ "message": "What is ringworm?" }
```

Stream event sequence:

```json
{"type":"start","conversation":{},"userMessage":{},"sources":[]}
{"type":"delta","content":"Ringworm "}
{"type":"delta","content":"is ... [1]"}
{"type":"complete","conversation":{},"userMessage":{},"assistantMessage":{}}
```

The response uses `Cache-Control: no-cache, no-transform` and `X-Accel-Buffering: no` to reduce proxy buffering.

### 6.4 Key Internal Contracts

- `Message.metadata.sources` is an optional array of `{id, title, page}`.
- Citation IDs are local to one answer and correspond to the retrieved source-page labels supplied to the model.
- The conversation summary column exists but no service currently writes or reads summaries.
- Non-streamed sending remains implemented for API compatibility, while the console uses the stream endpoint.
- The server does not expose model chain-of-thought or safety classifier labels.

---

## 7. Repository Map

```text
Medical-Chatbot-GenAI/
|-- app.py                         # Flask entry point
|-- backend/
|   |-- ai/                        # OpenRouter clients and prompts
|   |-- api/                       # Authenticated conversation routes
|   |-- data/                      # PDF loading, splitting, cache
|   |-- repositories/              # SQL persistence queries
|   |-- services/                  # Conversation memory and RAG
|   |-- auth.py                    # Clerk JWT verification
|   |-- config.py                  # Environment-backed settings
|   |-- extensions.py              # SQLAlchemy and migration objects
|   |-- models.py                  # Relational entities
|   `-- vector_store.py            # Pinecone lifecycle/adapter
|-- Data/
|   `-- Medical_book.pdf           # Current medical corpus
|-- frontend/
|   |-- app/                       # Next App Router pages and global CSS
|   |-- components/                # Chat, auth, landing, brand, loaders
|   |-- lib/                       # Typed API client and shared types
|   |-- public/images/             # Landing/reference raster assets
|   |-- proxy.ts                   # Clerk route protection
|   |-- package.json               # Frontend dependencies/scripts
|   `-- tsconfig.json              # Strict TypeScript configuration
|-- migrations/                    # Alembic environment and revisions
|-- tests/                         # Backend API and RAG tests
|-- docs/                          # Architecture and benchmark documents
|-- requirements.txt               # Python dependency constraints
|-- setup.py                       # Editable package metadata
`-- store_index.py                 # Operator indexing CLI
```

### 7.1 High-Change Files

| Change | Primary files | Coupled concerns |
|---|---|---|
| Add an API field | `backend/api/conversations.py`, `frontend/lib/types.ts`, `frontend/lib/api.ts` | Serialization and client types must remain aligned. |
| Change persistence | `backend/models.py`, repository/service, new Alembic revision | Never edit an already-applied migration to represent a new production change. |
| Change retrieval | `backend/services/rag.py`, `backend/config.py`, tests | Rebuild index when embeddings/chunks change; benchmark retrieval before release. |
| Add source PDFs | `Data/`, index job | Validate copyright, date, extraction, metadata, and index coverage. |
| Change models | `.env` values and `backend/ai/openrouter.py` | Verify compatibility, quotas, context size, response format, and privacy terms. |
| Change chat UX | `chat-workspace.tsx`, `globals.css`, API types | Test streaming, optimistic IDs, scrolling, mobile sidebar, keyboard use, and both themes. |
| Change auth | `frontend/proxy.ts`, Clerk dashboard, `backend/auth.py`, origin variables | Test sign-in redirect, token issuer, authorized party, CORS, and owner isolation together. |

---

## 8. Operations, Troubleshooting, and Production Gaps

### 8.1 Common Failures

| Symptom | Likely cause | Resolution |
|---|---|---|
| `Missing required environment variables` | Root environment is incomplete or process started from the wrong directory. | Confirm root `.env` and required variable names; restart the process. |
| `Authentication required` after login | No/expired Clerk token, issuer mismatch, or unauthorized `azp`. | Compare Clerk token issuer and frontend origin with backend settings; verify frontend Clerk keys belong to the same instance. |
| History is empty for an existing user | Different Clerk instance/subject or different database. | Verify publishable key, issuer, backend environment, and `DATABASE_URL`. |
| CORS failure | Frontend origin missing from authorized parties. | Add exact scheme/host/port to `CLERK_AUTHORIZED_PARTIES` and restart Flask. |
| Pinecone index does not exist | Configured index was never built or name differs. | Build the exact `PINECONE_INDEX_NAME` and restart the backend. |
| Pinecone dimension mismatch | Index was built with another embedding model. | Build a new index using the configured embedding model and switch names. |
| Indexing appears idle | Hosted embedding batch is still executing or provider is throttling. | Wait for flushed progress, lower `--batch-size`, inspect provider quotas, and do not interrupt index creation without checking Pinecone state. |
| Poor or "library does not provide" answer | Retrieval missed evidence or the single source lacks the topic. | Inspect retrieved chunks, test lexical/semantic results, and expand with validated current sources rather than loosening grounding. |
| Long pause before streamed text | Evidence review waits for a complete draft. | This is expected with review enabled; measure stage latency before changing the safety/quality tradeoff. |
| Dictation unavailable | Browser lacks Web Speech API or microphone permission. | Use a supported browser/secure origin and grant permission; typed input remains available. |
| Hydration mismatch on auth | Browser-only Clerk/theme state rendered before mount. | Keep Clerk form mount gating and avoid nondeterministic server/client markup. |
| `not enough space on disk` for Next/SST files | Local drive is full during the development build cache write. | Free disk space and remove regenerable `frontend/.next` cache while servers are stopped. This does not directly alter RAG answer quality. |

### 8.2 Production Readiness Priorities

1. Replace or supplement the dated single-volume corpus with licensed, current, medically reviewed sources and a documented update process.
2. Add retrieval evaluation with expected source passages, not only answer snapshots. The existing 100-question benchmark is at `docs/kio-rag-100-question-benchmark.md`.
3. Integrate safety classification and an explicit urgent-symptom policy; test false positives and false negatives.
4. Confirm provider contracts for medical data. Do not process PHI until legal, security, and compliance requirements are satisfied.
5. Add rate limiting, request size limits at the proxy, abuse controls, structured logs, traces, latency/error metrics, and alerts.
6. Add CI for Python tests, frontend type/build checks, dependency scanning, migration checks, and end-to-end auth/chat tests.
7. Add database backup/restore tests, retention and deletion policies, and an operator runbook.
8. Add streaming cancellation and a recoverable message status model so disconnected/failed generations can be retried cleanly.
9. Add a dependency lock strategy for Python and explicit development dependencies.
10. Introduce Redis only when multiple instances need shared rate-limit state, cache coordination, or queued background work.

### 8.3 Architectural Constraints to Preserve

- Keep the safety classifier separate from the generative answer model.
- Keep all conversation reads and writes owner-scoped.
- Keep source citations tied to exact retrieved excerpts and filter unused sources.
- Do not bypass migrations with `db.create_all()` outside tests.
- Do not rebuild a production vector index destructively when a versioned cutover is possible.
- Do not expose `CLERK_SECRET_KEY`, database credentials, or AI-provider keys to browser code.
- Treat Markdown and model output as untrusted input.

---

## 9. Current-State Summary

KIO has a coherent two-application architecture: a strict TypeScript/Next.js interface and a layered Flask/PostgreSQL RAG backend. Its strongest implemented qualities are account-owned durable history, hybrid retrieval, citation-aware evidence review, progressive NDJSON rendering, and a consistent accessible theme system.

Its principal production risks are not code organization but evidence coverage, clinical validation, external-provider privacy, missing moderation enforcement, and absent operational automation. Engineers should preserve the current grounding boundaries while improving corpus quality, evaluation, observability, and release controls.
