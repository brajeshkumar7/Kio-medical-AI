# KIO frontend

Next.js App Router frontend for KIO Medical AI, with Clerk authentication,
account and guest conversations, streamed answers, and browser dictation.

## Local setup

Use a supported Node.js LTS release (Node 22.13+ or Node 24 is recommended for
the development tooling) and npm. From this directory:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Copy the environment example only on first setup; preserve an existing
`.env.local`. Configure your own Clerk keys and start the backend separately.
The frontend defaults to `http://localhost:3000` and the backend to
`http://localhost:8080`.

| Variable                             | Purpose                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------ |
| `NEXT_PUBLIC_API_URL`                | Backend base URL, embedded in the browser bundle at build time           |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`  | Clerk browser publishable key                                            |
| `CLERK_SECRET_KEY`                   | Clerk server-only secret; never expose through a `NEXT_PUBLIC_` variable |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`      | Sign-in entry point, currently `/`                                       |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`      | Sign-up entry point, currently `/sign-up`                                |
| `NEXT_PUBLIC_CLERK_KEYLESS_DISABLED` | Keep explicit Clerk key configuration enabled                            |

Root-level backend environment files are separate from this frontend's
`.env.local`. Commit examples only, never real keys. Use production Clerk keys
for a production deployment.

## Commands

| Command              | Purpose                                                        |
| -------------------- | -------------------------------------------------------------- |
| `npm run dev`        | Start development with Webpack                                 |
| `npm run lint`       | Run Next.js/TypeScript ESLint rules with zero warnings allowed |
| `npm run typecheck`  | Regenerate route types and check TypeScript                    |
| `npm test`           | Run regression tests once                                      |
| `npm run test:watch` | Run tests interactively                                        |
| `npm run build`      | Create a production build                                      |
| `npm start`          | Serve the production build                                     |

Development explicitly uses `next dev --webpack` because Turbopack previously
panicked while updating its route tree during hot reload. The production build
retains the default Turbopack bundler and passes verification after the refactor.
After changing source layout or configuration, stop and restart the development
server. `next build` does not run ESLint; run lint, typecheck, tests, and build
as separate release checks.

## Source layout

```text
src/
  app/                 Routes, server layout, loading boundary, favicon
  features/
    auth/components/   Authentication shell, Clerk forms, care signal
    chat/
      components/      Workspace, sidebar, composer, messages, status views
      hooks/           Chat controller, health polling, browser dictation
      services/        Conversation requests, NDJSON decoder, guest lifecycle
      constants.ts     Starter prompts
      types.ts         Conversation, message, source, quota, and stream types
  components/
    brand/             Shared brand marks and animated loaders
    feedback/          Route loading view
  providers/           Clerk/theme/toast provider composition
  lib/http/            Shared API URL, headers, JSON/error handling, health probe
  styles/              Global stylesheet, with original cascade preserved
  proxy.ts             Clerk middleware and protected-route matching
tests/                 Mocked network, session, controller, and browser API tests
```

`@/` resolves to `src/`. Keep route files thin, feature logic inside its feature,
and shared providers and branding outside individual features. View props use
typed subsets of controller state and actions. Keep API wire formats in sync
with the existing backend; the refactor does not change them.

There must be only one application tree and one Clerk proxy. Public assets,
Next.js/TypeScript/PostCSS/ESLint configuration, and environment files stay at
the frontend root. Keep `favicon.ico` in `src/app` so it is served as metadata
rather than reaching the authentication catch-all.

## Routes and behavior

- `/` and the existing authentication catch-all show sign-in; signed-in users
  redirect to `/console`.
- `/sign-in/[[...sign-in]]` and `/sign-up/[[...sign-up]]` retain Clerk's nested
  authentication flows.
- `/console` is protected by `src/proxy.ts`.
- `/guest` allows guest chat and redirects signed-in users to `/console`.

Conversation requests retain `Bearer` authorization for accounts and `Guest`
authorization for guests. Streaming uses newline-delimited JSON events. The
controller owns optimistic messages, streamed-answer presentation, history,
guest transfer, and quota refresh. Backend health is checked on entry, every
15 seconds while visible, and on browser connectivity/visibility events.

Existing storage keys are preserved: `kio-theme`, `kio-sidebar-collapsed`, and
`kio-guest-token`. Speech recognition requires browser support and microphone
permission. Tests mock speech APIs and never request a real microphone.

## Verification

Tests cover stream fragmentation and failures, guest token reuse/expiry/claim,
optimistic-message reconciliation, conversation selection/deletion, guest quota
blocking, dictation accept/cancel/cleanup, and backend recovery. They do not
require Clerk credentials or a running backend.

Before releasing UI changes, also compare desktop/mobile and light/dark views,
exercise real Clerk sign-in/sign-up, and verify guest-chat transfer and a real
streamed answer against the backend. Mocked tests do not replace these checks.

The refactor preserves runtime dependency versions. At verification, `npm audit`
reported four existing affected packages: Next.js (critical), sharp, nanoid, and
source-map-js (high). Review and upgrade these separately before deployment;
this refactor does not establish that the pinned dependencies are security-current.
