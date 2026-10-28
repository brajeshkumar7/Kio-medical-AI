# Deployment compatibility and rollback

For both applications on Vercel, follow the complete
[Vercel deployment guide](vercel-deployment.md), also available as a
[Word document](KIO-Vercel-Deployment-Guide.docx). It covers private lexical-cache
provisioning, serverless configuration, staging, and production promotion.
The conventional-server instructions below remain supported.

The repository-based deployment and existing commands remain supported. This
refactor does not introduce containers, deploy a release, change secrets, or
modify the hosted database/vector index.

## Backend

Use the repository root and Python 3.11:

```text
pip install -r requirements.txt
flask --app app db upgrade
gunicorn app:app
```

Local development stays `python app.py`. Configure host secrets using the root
`.env.example` as a list of names. Preserve model/index choices for the refactor.
The wheel/sdist contain supported application code, not environment files,
PDFs, notebooks, legacy code or migration revisions. Deploy from the checkout
so `migrations/` is available to the pre-deploy command.

Provision the source PDF library separately at repository-root `Data/` and
writable `.cache/` storage. Source names and modification times affect cache
identity, as before. No indexing is part of startup or release verification.

Keep the existing `python -m backend.jobs.purge_guests` schedule and its
database-only configuration. Its unchanged workflow still installs through root
`requirements.txt`. Never supply live database credentials to test CI.

## Frontend

Use `frontend/` as the working directory, `npm ci`, and `npm run build`. Run
`npm start` on a Node host or retain the current Next.js hosting integration.
Configure production Clerk keys and the public API URL on that host. Public
variables are embedded at build time. Configure the actual frontend origin in
backend CORS and Clerk authorized-party settings.

## Release and rollback

Require both CI jobs to pass: dependency installation, Python quality/tests,
disposable PostgreSQL migrations, fresh runtime install, Gunicorn import/config
check, package contents, and frontend checks/build. Then perform real sign-in,
guest, retrieval, streaming and desktop/mobile light/dark staging checks.

Dependency advisories and the unreadable adversarial safety case recorded in
[safety.md](safety.md) remain separate release concerns. Structural parity does
not resolve them or certify medical accuracy.

Rollback by deploying the previous known-good revision/artifact with its matching
Python/npm locks. Preserve the same environment, database, index, `Data/` and
cache. No migration was added, so the refactor requires no schema downgrade or
re-embedding for rollback. Starting `legacy/src` is not the supported rollback.
