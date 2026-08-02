# KIO Medical AI

KIO is an enterprise medical AI landing experience and authenticated RAG
assistant with durable conversation history.

For the complete as-built architecture, technology rationale, workflows, API
contracts, setup, and operations guide, see
`docs/KIO_TECHNICAL_DOCUMENTATION.md`.

## Architecture

- frontend: Next.js 16, TypeScript, Tailwind CSS, Clerk authentication, the
  public KIO landing page, and the protected clinical console.
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
    NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
    NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
    NEXT_PUBLIC_CLERK_KEYLESS_DISABLED=true

Start Next.js:

    npm run dev

Open http://localhost:3000 for the public KIO Medical AI landing page. Launch
the protected workspace at http://localhost:3000/console, create an account,
and send a message. KIO creates a PostgreSQL conversation on the first message,
stores both sides of every exchange, and reloads the user-owned history after
future sign-ins.

## Render deployment

Use flask --app app db upgrade as the backend pre-deploy command and
gunicorn app:app as the start command. Set the production frontend URL in both
FRONTEND_ORIGIN and CLERK_AUTHORIZED_PARTIES. Set NEXT_PUBLIC_API_URL to the
deployed Flask URL.
