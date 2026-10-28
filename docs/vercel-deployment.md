# KIO Vercel Deployment Guide

Deploy the Next.js frontend and Flask backend as two Vercel projects connected to the same GitHub repository. Start with a hosted staging release on vercel.app using Clerk development keys. A public production launch requires a custom frontend domain and production Clerk setup, described in section 12.

Commands use Windows PowerShell. Run each block in its stated directory and replace every YOUR_* placeholder. Never copy secret values into this document or Git. Creating resources, uploading the private cache, migrating databases, and deploying are operator actions that you execute yourself.

## 1 Prepare accounts and local checks

You need GitHub and Vercel accounts, Node 24, Python 3.12 for release checks, an external PostgreSQL database, the working Clerk development instance, OpenRouter access, and the existing populated Pinecone index. Python 3.11 remains supported locally. Vercel supports Python 3.12 through 3.14; .python-version selects 3.12.

Rotate the Clerk secret previously shared in chat before hosted use. Replace it yourself in the appropriate local and hosted environments. The publishable key and secret must belong to the same Clerk instance. Never prefix server secrets with NEXT_PUBLIC_.

Directory: repository root. Open a new PowerShell terminal:

```powershell
$projectRoot = 'D:\Medical-Chatbot-GenAI'
Set-Location -LiteralPath $projectRoot
git status --short
node --version
npm --version
py -3.12 --version
npm install --global vercel@latest
vercel --version
vercel login
```

Use Vercel CLI 50.20.0 or newer for private Blob commands. Check the CLI help if a later version changes syntax. Keep .vercel project-link files and downloaded environments out of Git.

Create a separate release environment without replacing your existing environment:

```powershell
py -3.12 -m venv .cache\release-py312
$releasePython = Join-Path $projectRoot '.cache\release-py312\Scripts\python.exe'
& $releasePython -m pip install -r requirements/development.txt -e .
& $releasePython -m pip check
& $releasePython -m ruff check .
& $releasePython -m ruff format --check .
& $releasePython -m pytest
```

Expected: checks pass. The PostgreSQL migration test needs an empty disposable TEST_POSTGRES_URL database whose name ends in _test; the package-content check needs a built wheel. CI supplies those checks on Linux. Never give tests the hosted application database.

Directory: frontend. Run each check separately and stop on failure:

```powershell
Set-Location -LiteralPath (Join-Path $projectRoot 'frontend')
npm ci
npm run lint
npm run typecheck
npm test
npm run build
Set-Location -LiteralPath $projectRoot
```

Review, commit, and push only the intended changes through your normal Git workflow. Require both CI jobs to pass, including Python 3.12 on Linux. Dependency advisories and the safety-evaluation limitation documented in docs/safety.md remain separate release concerns.

## 2 Understand the project settings

Use names such as kio-api-staging and kio-web-staging. Record the actual domains Vercel assigns if those names are unavailable.

| Setting | Backend | Frontend |
| --- | --- | --- |
| Root Directory | Repository root shown as ./ | frontend |
| Framework Preset | Flask | Next.js |
| Runtime | Python 3.12 | Node 24.x |
| Install Command | uv pip install -r requirements/production.txt | npm ci |
| Build Command | python -m backend.jobs.prepare_vercel_cache | npm run build |
| Output Directory | Framework default | Framework default |
| Start command | None on Vercel | None on Vercel |

The backend exports app:app and uses a 300-second function duration. Vercel runs the WSGI application; do not start Gunicorn or python app.py as a build command. The install command uses the pinned runtime lock without editable installation. The build hook downloads the cache only; it does not create embeddings or migrate the database.

For the first staging release, use each project's stable vercel.app domain and Vercel's Production environment scope. Here Production is the platform deployment label; the app still uses development Clerk credentials. Do not give Preview deployments application credentials until section 10 is configured.

## 3 Provision PostgreSQL and apply migrations

Create a dedicated external staging PostgreSQL database in your chosen provider, such as Neon or Supabase. Enable backups/recovery. Choose a Vercel region near that database; also consider the existing Pinecone region. Hosted SQLite and filesystem persistence are not supported by this deployment.

Copy a TLS runtime connection URL suitable for the provider's serverless pooler and a separate direct or session-capable migration URL. Follow the provider's exact host, port, database, and psycopg prepared-statement requirements, especially with transaction poolers. URL-encode password characters.

Example runtime URL: postgresql+psycopg://USER:PASSWORD@POOLER_HOST:PORT/DATABASE?sslmode=require. On Vercel set DATABASE_POOL_MODE=null to avoid a separate persistent application connection pool in every function instance. External database connection limits still apply.

Directory: repository root. Back up an existing database first. Read the direct staging URL without storing it in terminal history, run migrations once, then restore the environment:

```powershell
Set-Location -LiteralPath $projectRoot
$previousDatabaseUrl = $env:DATABASE_URL
$migrationSecret = Read-Host 'Direct staging PostgreSQL URL' -AsSecureString
$migrationCredential = [System.Net.NetworkCredential]::new('', $migrationSecret)
try {
    $env:DATABASE_URL = $migrationCredential.Password
    & $releasePython -m flask --app app db upgrade
    if ($LASTEXITCODE -ne 0) { throw 'Migration failed; stop deployment' }
    & $releasePython -m flask --app app db current
} finally {
    $env:DATABASE_URL = $previousDatabaseUrl
    Remove-Variable migrationSecret, migrationCredential
}
```

App import also requires the service settings from your existing local .env; QA clients initialize lazily and this command does not embed documents. Expected: migration succeeds and db current shows the latest checked-in revision. No new database revision is part of these Vercel changes. Do not run migrations during every Vercel build.

## 4 Export the existing lexical cache

Hybrid retrieval needs both Pinecone and lexical chunks. Deploy a portable artifact instead of the PDFs, which currently total about 329 MB. Use the machine with the original Data files and matching existing .cache.

Directory: repository root:

```powershell
Set-Location -LiteralPath $projectRoot
& $releasePython -m backend.jobs.export_lexical_cache `
    --output .cache/lexical-v1.json.gz
Get-FileHash -LiteralPath '.cache/lexical-v1.json.gz' -Algorithm SHA256
```

Expected: the manifest and compressed artifact SHA256 are printed. Check document_count is 16 for the current library and chunk_count matches the completed indexing run. Preserve CHUNK_SIZE/CHUNK_OVERLAP and the existing index/model pairing. Do not overwrite working model choices with .env.example defaults.

The exporter selects the existing cache using the same PDF filenames, sizes, modification times, and chunk settings as local ingestion. It reads that cache only. If no cache matches, it stops without extracting PDFs or contacting providers. Export on the original machine before touching or moving PDFs. Do not run --recreate as part of deployment.

The artifact preserves chunk text, metadata, order, pages, and source references. Its manifest checks format version, counts, chunk settings, and content checksum; the build also checks the compressed file's SHA256. It contains source-book text: confirm upload rights and keep it out of Git and public asset directories.

## 5 Create and link both projects

In Vercel choose Add New > Project, import the GitHub repository as kio-api-staging, select Flask, and keep Root Directory at repository root. Use section 2 settings. The root vercel.json sets the install command; pyproject.toml supplies the cache build hook. Remove conflicting dashboard overrides.

Import the same repository a second time as kio-web-staging, select Next.js, set Root Directory to frontend, and select Node 24.x. Keep framework output defaults. No additional frontend vercel.json is necessary.

If an initial build starts before storage/secrets are ready, let it fail and complete setup before redeploying. A failed setup build is not a release. Record stable domains from each project's Settings > Domains.

Directory: repository root. Link CLI commands to the backend project; select the correct team/project interactively:

```powershell
Set-Location -LiteralPath $projectRoot
vercel link
```

Directory: frontend. Create its independent CLI link to the frontend project:

```powershell
Set-Location -LiteralPath (Join-Path $projectRoot 'frontend')
vercel link
Set-Location -LiteralPath $projectRoot
```

Check the local .vercel/project.json before commands if unsure which project is linked. Never commit project links or pulled secret files.

## 6 Upload the artifact to private storage

Directory: repository root linked to the backend. These operator commands create storage and upload source-derived text; review upload rights and charges before running them:

```powershell
Set-Location -LiteralPath $projectRoot
vercel blob create-store kio-lexical-staging --access private --yes
vercel blob put .cache/lexical-v1.json.gz `
    --access private --pathname lexical/v1/lexical-v1.json.gz
```

Confirm the store is Private and connected to the backend project. Record the returned private URL. In the store settings obtain a BLOB_READ_WRITE_TOKEN for build-time download if one is not already attached. Keep it only in backend environment settings. The downloader uses this explicit credential without adding a Blob SDK or relying on runtime OIDC refresh.

Use a new pathname for every changed artifact, for example lexical/v2/lexical-v2.json.gz. Retain old versions for rollback; do not overwrite artifacts used by older releases. Never upload these files into frontend/public or change the store to Public.

## 7 Configure backend variables

Open backend Settings > Environment Variables. Initially select Production only for the hosted staging release. Use dashboard sensitive-value controls for credentials.

| Variable | Local | Vercel staging |
| --- | --- | --- |
| DATABASE_URL | Existing value | Dedicated staging TLS runtime URL |
| DATABASE_POOL_MODE | default | null |
| PINECONE_API_KEY | Existing value | Key authorized for the populated index |
| OPENROUTER_API_KEY | Existing value | Working key with required access/credit |
| CLERK_ISSUER_URL | Development issuer | Same issuer as frontend staging keys |
| GUEST_IP_HASH_SECRET | Local secret | Stable random staging secret |
| FRONTEND_ORIGIN | http://localhost:3000 | Exact frontend HTTPS origin |
| CLERK_AUTHORIZED_PARTIES | http://localhost:3000 | Same exact frontend HTTPS origin |
| TRUSTED_PROXY_HOPS | 0 | 1 for direct Vercel ingress |
| LEXICAL_CACHE_PATH | Empty | backend/_artifacts/lexical-cache.json.gz |
| LEXICAL_CACHE_ARTIFACT_URL | Unset | Versioned private Blob URL |
| LEXICAL_CACHE_ARTIFACT_SHA256 | Unset | Compressed artifact SHA256 |
| BLOB_READ_WRITE_TOKEN | Unset | Private store build credential |

Use no trailing slash for origins. Authorized parties accepts comma-separated exact origins when intentionally supporting multiple clients. Do not use wildcards. Generate a guest hashing secret locally and copy it into the backend dashboard; keep it stable across deployments:

```powershell
& $releasePython -c "import secrets; print(secrets.token_hex(32))"
```

Copy all working model and retrieval values into the backend project rather than changing them during deployment:

| Group | Variables |
| --- | --- |
| Provider endpoint | OPENROUTER_BASE_URL if customized |
| Index | PINECONE_INDEX_NAME |
| Models | OPENROUTER_CHAT_MODEL, OPENROUTER_REVIEW_MODEL, OPENROUTER_SAFETY_MODEL, OPENROUTER_EMBEDDING_MODEL |
| Retrieval | RETRIEVAL_K, RETRIEVAL_FETCH_K, RETRIEVAL_LAMBDA_MULT, RETRIEVAL_LEXICAL_K, RETRIEVAL_CONTEXT_K |
| Chunking | CHUNK_SIZE, CHUNK_OVERLAP matching the artifact |
| Answers | ANSWER_MAX_TOKENS, ANSWER_REVIEW_ENABLED, HISTORY_MESSAGE_LIMIT |

Set FLASK_DEBUG=false if defined. Vercel does not need FLASK_HOST/FLASK_PORT. The embedding model and index dimensions must match the existing indexed data. Preserve OpenRouter privacy/ZDR settings and compatible endpoints; the safety classifier is separate from the answer model.

Vercel documents that it overwrites incoming X-Forwarded-For values. TRUSTED_PROXY_HOPS=1 trusts its last ingress hop for network quotas. This assumes direct Vercel traffic without an additional CDN or custom proxy product. Reassess trust before adding another proxy, and do not enable this on an exposed local Flask server.

## 8 Configure frontend and Clerk

Open frontend Settings > Environment Variables and initially select Production for staging:

| Variable | Local | Vercel staging |
| --- | --- | --- |
| NEXT_PUBLIC_API_URL | http://localhost:8080 | Stable backend HTTPS origin |
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY | pk_test value | Staging development publishable key |
| CLERK_SECRET_KEY | sk_test value | Rotated matching development secret |
| NEXT_PUBLIC_CLERK_SIGN_IN_URL | / | / |
| NEXT_PUBLIC_CLERK_SIGN_UP_URL | /sign-up | /sign-up |
| NEXT_PUBLIC_CLERK_KEYLESS_DISABLED | true | true |

NEXT_PUBLIC_API_URL must not end in /api because clients add endpoint paths themselves. Do not put database, Blob, Pinecone, or OpenRouter secrets in this project. Public variables are embedded into browser assets; changing the API URL requires a frontend rebuild.

In the matching Clerk development instance confirm signup is enabled. Configure the deployed frontend as an allowed application/redirect origin wherever that instance's dashboard requires it. Keep sign-in at / and sign-up at /sign-up. Configure social-provider redirect URLs separately if using Google login; email login success does not verify social login.

The homepage sign-in form uses hash routing for internal steps so it cannot capture /sign-up. Dedicated auth routes keep path routing. A development-key warning is expected on staging. Production credentials require the custom-domain steps in section 12.

## 9 Deploy and connect staging

Redeploy the backend in its dashboard after configuring variables/storage. Expected build log: Validated lexical cache with the intended document/chunk counts. The function must contain the generated private artifact and exclude PDFs. Health reports process availability only, not initialized retrieval/provider readiness.

For local build inspection, use the backend CLI context. Pulling environment values creates an ignored secret file; never print it:

```powershell
Set-Location -LiteralPath $projectRoot
vercel pull --yes --environment=production
vercel build --prod
& $releasePython -m backend.jobs.check_vercel_bundle `
    --chunk-size 1200 --chunk-overlap 180
```

Use actual artifact chunk settings if different. Expected: a function below the standard 500 MiB limit with a verified lexical artifact. The check fails if output or the artifact is missing, or forbidden application files are bundled. If local Windows tooling cannot run the Python builder, inspect the equivalent output on Linux or Vercel before release; an unbuilt function has not passed size verification.

Optional operator deployment of an inspected local build:

```powershell
vercel deploy --prebuilt --prod
```

Git auto-deployment remains the normal workflow. Pushes to the configured production branch rebuild both projects; other branches create Previews. For variable-only updates use dashboard Redeploy. Check revision and project before promoting a separate prebuilt deployment.

Verify the backend and cross-origin preflight with actual domains:

```powershell
$apiOrigin = 'https://YOUR_API_PROJECT.vercel.app'
$webOrigin = 'https://YOUR_WEB_PROJECT.vercel.app'
Invoke-RestMethod -Uri "$apiOrigin/health"
$corsHeaders = @{
    Origin = $webOrigin
    'Access-Control-Request-Method' = 'POST'
    'Access-Control-Request-Headers' = 'authorization,content-type'
}
$corsResult = Invoke-WebRequest -Method Options `
    -Uri "$apiOrigin/api/conversations" -Headers $corsHeaders
$corsResult.StatusCode
$corsResult.Headers['Access-Control-Allow-Origin']
```

Expected: health returns status ok; preflight succeeds with the exact frontend origin. An unauthenticated GET /api/conversations must return Flask HTTP 401, not a Vercel protection HTML page.

Browser fetches cannot transparently pass Vercel's login protection across these domains. For the intentionally public staging API, configure project protection so the chosen stable API domain accepts requests, retaining Clerk/guest-token authentication inside the app. Keep other previews protected. Never expose a protection-bypass secret in browser JavaScript. If the plan cannot exempt that domain, use a separate appropriately configured public staging project.

Redeploy the frontend after confirming its public API URL. Open its stable URL and complete section 11. Record successful deployment URLs, Git revision, and cache checksum without secrets.

## 10 Configure previews and Git automation

Do not give pull-request previews live production databases or Clerk identities. Use a disposable preview PostgreSQL database and development Clerk instance. Scope Preview variables independently in both projects; frontend keys and backend issuer must match.

For paired previews, deploy the backend preview with its isolated data and cache variables, put that URL in branch-specific frontend NEXT_PUBLIC_API_URL, and deploy the frontend preview. Add the exact resulting frontend origin to the backend branch's FRONTEND_ORIGIN and CLERK_AUTHORIZED_PARTIES, then redeploy the backend. Keep those URLs stable for the test session. Never allow every vercel.app origin as a shortcut.

Use branch-specific variables and stable aliases if your Vercel plan provides them. Otherwise keep previews protected and test end-to-end through the stable staging projects. A protected backend preview can build successfully while browser API requests still fail.

CLI alternative: run vercel env add NAME production or vercel env add NAME preview from the correct linked directory. These commands prompt for values; do not pass secret literals on the command line. Environment changes apply to new deployments, so redeploy after editing them.

## 11 Run hosted acceptance checks

Use disposable staging accounts/conversations. Answer and safety calls incur ordinary provider charges. Use generic questions rather than patient data.

- Open /, /sign-in, and /sign-up signed out. Click Sign up and return to Sign in; verify no auth loop or Clerk middleware error.
- Visit /console signed out and confirm authentication is required. Sign in and confirm the console opens and / redirects there. Complete signup yourself if testing account creation.
- Open /guest, inspect the allowance, ask a generic question, and confirm answer text and sources. Sign in to claim that conversation and confirm it appears once.
- Create, select, and delete disposable conversations; refresh and verify persistence and account isolation.
- Inspect the streaming request in browser DevTools: expect application/x-ndjson, complete events, and no function timeout. Output safety buffering intentionally delays visible answer text.
- Exercise an ordinary safety-redirection case and a controlled mocked/provider-unavailable case in staging. Expect the existing safe response or retry message and no unchecked answer.
- Verify citations map to displayed sources with correct page references. Citation labels are not numbered answer paragraphs.
- Verify image delivery at /favicon.ico, theme persistence, sidebar controls, desktop/mobile layout, and unchanged logo animation.
- Simulate API unavailability with browser request blocking. Confirm the offline message and retry button, then unblock and verify recovery.
- Review both project logs for exceptions, auth loops, CORS failures, read-only writes, quota anomalies, provider failures, and timeouts.

Do not accept deployment solely because /health returns 200. An authorized, safety-checked retrieval answer must finish successfully on hosted staging before promotion.

## 12 Promote to production with a custom domain

Clerk production requires a domain you own; it cannot use vercel.app as the frontend production domain. The backend may retain its stable Vercel API domain.

1. Add the frontend domain in Vercel Settings > Domains, apply its exact DNS records, and wait for domain/TLS verification.
2. Configure Clerk's production instance for that domain, complete Clerk DNS verification, social-provider setup, and allowed redirects.
3. Replace frontend Production variables with the matching pk_live key and sk_live secret. Set backend CLERK_ISSUER_URL to that production issuer.
4. Configure production PostgreSQL, a stable production guest hash secret, and exact production frontend origins. Keep staging and Preview credentials separate.
5. Back up the production database and apply checked-in migrations once through the direct connection, following section 3.
6. Preserve the validated Pinecone/index/embedding configuration. Provisioning a separately evaluated dataset is a separate task; this deployment does not require re-embedding.
7. Deploy backend, rebuild/deploy frontend, and repeat all hosted acceptance checks through the custom domain before announcing release.

Development Clerk users do not automatically become production users. Conversations are scoped by Clerk identity; changing instances does not transfer ownership. Do not rewrite user IDs or merge accounts during deployment. Handle any identity/data migration separately.

Keep dedicated staging projects if you need staging after promotion; do not repeatedly switch production back to development keys.

## 13 Maintain and monitor the deployment

The existing .github/workflows/purge-guests.yml schedule runs daily at 02:15 UTC, or 07:45 Asia/Kolkata. It installs through requirements.txt and needs only the GitHub Actions secret DATABASE_URL for the intended retention database. Set it in GitHub Settings > Secrets and variables > Actions.

Use the Actions UI to inspect or trigger the existing job. If GitHub CLI is installed/authenticated, directory repository root:

```powershell
gh secret set DATABASE_URL
gh workflow run purge-guests.yml
gh run list --workflow purge-guests.yml --limit 5
```

The first command prompts for the value. Cleanup removes expired guest data under the existing retention rules; confirm its target before triggering. No public Vercel cron endpoint is added.

Indexing remains an explicit offline maintenance job. These existing commands remain supported and do not mean indexing/evaluation should run during deployment:

```powershell
python app.py
python store_index.py --help
python -m backend.jobs.evaluate_safety --help
```

Read docs/safety.md before live evaluation, which calls providers. When the library changes through the normal ingestion process, export a new compatible artifact, upload at a new private pathname, update URL/checksum together, and redeploy. Keep artifact and Pinecone dataset paired.

Use Vercel Logs/Observability for request errors and duration. CLI commands run in the corresponding project's linked directory:

```powershell
vercel inspect https://YOUR_DEPLOYMENT.vercel.app
vercel logs https://YOUR_DEPLOYMENT.vercel.app
```

Monitor cold starts, total answer latency, provider errors, database connections, function memory/duration, and Blob/build costs. The 300-second cap includes retrieval, review, and both safety checks; streaming does not remove it. Do not log secrets, full conversations, or retrieved book text for diagnostics.

## 14 Roll back safely

Record known-good deployments and their matching Git revision, environment/model choices, chunk settings, private artifact version/checksum, and migration revision. In each Vercel project use Promote/Rollback for that known-good deployment as available on your plan. Check environment compatibility; new variable edits do not automatically change old built artifacts.

To rebuild from Git, revert the source/configuration change through a reviewed commit and rebuild both projects. Restore the previous Blob URL and checksum together when selecting an older dataset. Keep old artifacts available. Do not recreate Pinecone, rerun embeddings, or start archived code to roll back deployment.

These Vercel changes add no migration, so their rollback needs no schema downgrade. Later feature migrations may require a separate recovery plan. Repeat health, authentication, and a disposable chat test after rollback.

## 15 Troubleshoot failures

**Missing variables:** confirm project, Production/Preview scope, and dashboard install/build overrides. Redeploy after changes. Backend credentials do not belong in frontend settings.

**Cache download 401 or 403:** verify the Private Blob URL, backend build credential, store connection, and environment scope. Do not make the store public to bypass authentication.

**Checksum or manifest mismatch:** compare the compressed artifact hash and chunk settings with the exporter. The content checksum inside the manifest differs from the compressed-file SHA256. Use the intended immutable artifact version.

**Missing Data or read-only writes:** set LEXICAL_CACHE_PATH=backend/_artifacts/lexical-cache.json.gz, confirm the build hook ran, and inspect the included artifact. Configured artifact failures never silently fall back to PDFs.

**Python or dependency errors:** confirm Python 3.12 and the pinned production install command, then inspect Linux Python 3.12 CI. Review lock upgrades separately; do not replace locks with an unreviewed pip freeze.

**Oversized function:** run check_vercel_bundle on real output and inspect exclusions. Keep PDFs, local environments, frontend files, and developer assets out. The standard Python limit is 500 MB; do not claim size acceptance without a platform build or rely on beta large functions without review.

**Signup loops or middleware errors:** verify frontend Root Directory, src/proxy.ts, matching Clerk keys/issuer, and /sign-up URL. Retain homepage hash routing. Production Clerk requires the verified custom domain.

**CORS or failed fetch:** compare the compiled API URL with the API domain; inspect OPTIONS and exact allowed origin. A Vercel protection HTML page is not API JSON. Resolve access for the intended API domain without putting bypass credentials in the browser.

**Database failure:** verify TLS, password escaping, database name, provider network rules, pooler host/port, connection limits, and psycopg compatibility. Keep runtime pooling null; use direct/session-capable migration connections.

**HTTP 200 but no answer:** inspect NDJSON error events and backend logs; errors can occur after headers are sent. OpenRouter ZDR filtering/404s, credits, invalid keys, embedding/index mismatch, and safety outages require their respective configuration fixes.

**Slow answer or timeout:** separate cold initialization from database/provider latency. Safety buffers the full answer. Measure total duration against 300 seconds; health polling alone does not initialize the retrieval pipeline.

**Shared guest network allowance:** verify direct Vercel ingress and one trusted proxy hop. Additional proxies change that trust chain. Keep hashing secrets stable; do not disable quotas or log raw client addresses as a workaround.

## 16 References and release record

The Word edition has the same instructions as this Markdown source. Recheck platform references when changing runtimes or tooling:

- [Flask on Vercel](https://vercel.com/docs/frameworks/backend/flask)
- [Python runtime and versions](https://vercel.com/docs/functions/runtimes/python)
- [Function limits](https://vercel.com/docs/functions/limitations)
- [Private Blob storage](https://vercel.com/docs/vercel-blob/private-storage)
- [Blob CLI](https://vercel.com/docs/cli/blob)
- [Request headers](https://vercel.com/docs/headers/request-headers)
- [Clerk on Vercel](https://clerk.com/docs/guides/development/deployment/vercel)

Record Git revision, CI run, web/API URLs, private artifact version/checksum, database migration revision, hosted acceptance results, and rollback deployment references. Keep secrets out of that record.

Local checks establish code compatibility. A real Vercel build establishes packaged size/platform startup, and authorized hosted smoke tests establish the connected deployment. Mark those checks complete only after executing them.
