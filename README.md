# KIO Medical AI

KIO is an authenticated medical AI assistant with durable conversation history.

## Architecture

- frontend: Next.js 16, TypeScript, Tailwind CSS, Clerk authentication, and
  the protected clinical console.
- backend: Flask APIs, Clerk JWT verification, SQLAlchemy, and RAG services.
- PostgreSQL: users, conversations, and messages.
- retrieval: Pinecone semantic search fused with a cached local BM25 index and
  neighboring source chunks for exact medical terms and page-boundary context.
- OpenRouter: Nemotron 3 Nano for answer generation, Nemotron 3 Ultra for the
  evidence review, Nemotron Content Safety reserved for moderation, and NVIDIA
  embeddings for semantic retrieval.

Redis is intentionally not required. Add it when Kio needs a distributed rate
limiter, shared cache, or background job queue.

## External services

1. Create a Render PostgreSQL database. Use its external URL locally and its
   internal URL from the Render backend service.
2. Create a Clerk application. Enable email/password and the social providers
   you need, including Google.
3. Copy the Clerk publishable key, secret key, and Frontend API/issuer URL.
4. Create a Pinecone index from the project source documents and configure the
   OpenRouter generation and embedding models.

## Backend setup

From the project root, run:

    py -3.11 -m venv .venv
    .\.venv\Scripts\Activate.ps1
    python -m pip install --upgrade pip
    pip install -r requirements.txt

Update the root .env file with:

    PINECONE_API_KEY=...
    OPENROUTER_API_KEY=...
    DATABASE_URL=postgresql://...
    CLERK_ISSUER_URL=https://your-instance.clerk.accounts.dev
    GUEST_IP_HASH_SECRET=<random 32-byte secret>
    TRUSTED_PROXY_HOPS=0
    CLERK_AUTHORIZED_PARTIES=http://localhost:3000
    FRONTEND_ORIGIN=http://localhost:3000
    PINECONE_INDEX_NAME=medicalbot-v2
    OPENROUTER_CHAT_MODEL=nvidia/nemotron-3-nano-30b-a3b:free
    OPENROUTER_REVIEW_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
    OPENROUTER_SAFETY_MODEL=nvidia/nemotron-3.5-content-safety:free
    OPENROUTER_EMBEDDING_MODEL=nvidia/llama-nemotron-embed-vl-1b-v2:free
    RETRIEVAL_LEXICAL_K=4
    RETRIEVAL_CONTEXT_K=8

CLERK_ISSUER_URL is the iss value used by the Clerk instance. Do not use the
Clerk dashboard URL.

Apply the PostgreSQL migration and start Flask:

    flask --app app db upgrade
    python app.py

The API runs at http://localhost:8080. Conversation endpoints require a Clerk
session token. GET /health remains public.

Rebuild Pinecone when documents, the embedding model, or chunk settings change.
For production, build a versioned index first, verify it, and then switch
`PINECONE_INDEX_NAME` to avoid downtime:

    $env:PINECONE_INDEX_NAME="medicalbot-v3"
    python store_index.py --batch-size 32

## Frontend setup

From the project root, run:

    cd frontend
    Copy-Item .env.example .env.local
    npm install

Set these values in frontend/.env.local:

    NEXT_PUBLIC_API_URL=http://localhost:8080
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
    CLERK_SECRET_KEY=sk_test_...
    NEXT_PUBLIC_CLERK_SIGN_IN_URL=/
    NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

Start Next.js:

    npm run dev

Open http://localhost:3000 to sign in or choose **Continue as guest**. Guests
can ask three questions per UTC day across multiple conversations at /guest;
the API also limits each network address to 60 guest questions per UTC day.
Guest conversations stay in PostgreSQL for 30 days after the last visit and
transfer to the signed-in account automatically. After sign-in,
KIO opens the protected workspace at http://localhost:3000/console. Send a
message to create a PostgreSQL conversation on the first message. KIO
stores both sides of every exchange, and reloads the user-owned history after
future sign-ins.

## Render deployment

Use flask --app app db upgrade as the backend pre-deploy command and
gunicorn app:app as the start command. Set the production frontend URL in both
FRONTEND_ORIGIN and CLERK_AUTHORIZED_PARTIES. Set NEXT_PUBLIC_API_URL to the
deployed Flask URL. Set a stable, private GUEST_IP_HASH_SECRET in every backend
instance. Set TRUSTED_PROXY_HOPS to the number of trusted reverse proxies in
front of Flask (typically 1 on Render); leave it at 0 when serving directly.
The daily GitHub Actions cleanup workflow removes guest sessions and
conversations inactive for 30 days. Configure the repository's `DATABASE_URL`
Actions secret so it can connect to PostgreSQL. You can also run
`python -m backend.jobs.purge_guests` manually with `DATABASE_URL` set.

## Input and output safety checks

Account and guest answers now pass through a shared safety classifier before
retrieval and before any answer text is shown. Configure the paid
`OPENROUTER_SAFETY_MODEL=nvidia/nemotron-3.5-content-safety` endpoint in the
backend `.env`; restart the backend after changing it. ZDR remains enforced.
Classifier outages pause the answer with a retry message. Full output buffering
increases time to first answer text. No re-embedding or migration is required.
See [safety configuration, behavior, and staging evaluation](docs/safety.md).

## Repository organization and quality checks

Deploying both applications on Vercel: follow the
[deployment guide](docs/vercel-deployment.md) or its
[Word edition](docs/KIO-Vercel-Deployment-Guide.docx). Vercel uses Python 3.12;
local Python 3.11 remains supported. Start on vercel.app with staging credentials
before promoting to a custom domain with production Clerk credentials.

The supported Python package is `backend/`; the previous root `src/` is archived
intact under `legacy/src/` and excluded from production packaging. The existing
Next.js frontend remains under `frontend/`. Root startup, indexing, migration
and maintenance commands are preserved.

Project metadata and quality configuration live in `pyproject.toml`. Runtime and
development locks live under `requirements/`; `pip install -r requirements.txt`
remains supported. No database revision or re-embedding is needed for the refactor.

- [Architecture and module ownership](docs/architecture.md)
- [Development, tests and maintenance](docs/development.md)
- [Deployment and rollback](docs/deployment.md)
- [Dependency installation and lock regeneration](requirements/README.md)

CI validates Python 3.11 and Node 24, including a disposable PostgreSQL migration
test. It never runs live provider evaluation, document embedding or index deletion.
