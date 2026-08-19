# CLAUDE.md

Guidance for AI coding agents working in this repository. Read [PLAN.md](PLAN.md) for the
architecture rationale and [TODO.md](TODO.md) for known gaps before starting new work.

## What this is
FeedbackHub: a self-hostable, multi-tenant feedback & survey widget platform (SurveyMonkey-like,
but for lightweight contextual feedback embedded in web products). Monorepo with an Express API, a
Next.js admin dashboard, a vanilla-JS embeddable SDK, and a static demo site.

## Repo layout
```
apps/api/          Express + TypeScript REST API (port 4000)
apps/dashboard/     Next.js admin dashboard (port 3000)
apps/demo/          Static demo site + tiny Express server (port 3001)
apps/e2e/           Playwright end-to-end test for the Definition of Done flow
packages/shared/    Framework-independent types (QuestionType, roles, NPS calc)
packages/sdk/       Embeddable JS SDK, bundled with esbuild to dist/sdk.js
packages/react/     FeedbackHubProvider + useFeedback wrapper around the SDK
database/migrations/  Plain numbered .sql files (no ORM), applied by a custom runner
database/seeds/     Pointer to apps/api/src/scripts/seed.ts
docker/             Per-app Dockerfiles
docker-compose.yml  postgres, redis, migrate (one-shot), api, dashboard, demo
```

## Conventions
- **No ORM.** Database access is raw `pg` with parameterised SQL (`$1, $2...`). Never build SQL
  with string concatenation/interpolation of user input.
- **Migrations** are plain `.sql` files in `database/migrations/`, named `NNNN_description.sql`,
  applied in filename order and tracked in a `schema_migrations` table. Never edit an already-
  applied migration — add a new one.
- **Tenant isolation is mandatory.** Every project/organisation-scoped route must go through
  `requireProjectPermission` / `requireProjectMembership` / `requireOrgPermission` /
  `requireOrgMembership` in `apps/api/src/middleware/tenant.ts`. Never trust a `projectId` or
  `organisationId` from the request body/query without verifying membership.
- **Public vs admin API.** Routes under `/api/v1/public/*` and `POST /api/v1/responses` are
  authenticated via a project **public key** (`resolveProjectByPublicKey`), not a user session.
  Never require `requireAuth` on these; never expose secret API keys to them.
- **Passwords/secrets**: Argon2id for passwords (`lib/password.ts`), SHA-256 hash for
  refresh/reset tokens and secret API keys (`lib/tokens.ts`). Secret values (API secret keys,
  webhook secrets) are only ever returned once, at creation/rotation time.
- **SDK must never break the host page.** Every public SDK method and network call is wrapped in
  try/catch and fails silently (or via `console.warn` when `debug: true`). Don't add code paths
  that can throw synchronously from `init()`/`track()`/`open()`/etc.
- **Extensibility**: question/widget types are a closed TS union in `packages/shared/src/index.ts`
  (`QuestionType`), but question `config` and answer `value` are stored as JSONB — adding a new
  question type means extending the union + adding a renderer case in
  `packages/sdk/src/render.ts` + a builder case in the dashboard survey builder, not a migration.
- **Conditional logic** is intentionally AND-only today (`ConditionalLogic.all`). Don't silently
  extend this to OR/nested groups without updating both the SDK evaluator
  (`packages/sdk/src/render.ts` `evaluateCondition`) and the shared type.

## Commands
```bash
npm install                              # install all workspaces from repo root
npm run migrate --workspace apps/api     # apply DB migrations (needs DATABASE_URL)
npm run seed --workspace apps/api        # seed demo org/project/widgets/responses
npm run dev:api                          # API dev server (tsx watch), port 4000
npm run dev:dashboard                    # Next.js dev server, port 3000
npm run dev:demo                         # demo static server, port 3001
npm run build:sdk                        # bundle packages/sdk -> dist/sdk.js (esbuild)
npm run test:api                         # vitest + supertest integration tests (needs live Postgres)
npm run test:sdk                         # vitest + jsdom unit tests for packages/sdk
npm run test:dashboard                   # vitest + Testing Library tests for apps/dashboard
npm run test:e2e                         # Playwright end-to-end test (needs live Postgres + built api/dashboard)
docker compose up                        # full stack: postgres, migrate, api, dashboard, demo
```

## When making changes
- Adding an API route: put it in the relevant `apps/api/src/modules/<name>/routes.ts`, wrap
  handlers in `asyncHandler`, validate input with `zod` via `validateBody`/`validateQuery`, and
  gate access with the tenant middleware described above.
- Adding a DB column/table: create a new file in `database/migrations/`, never edit
  `0001_init.sql` directly.
- Adding a widget/question type: update `packages/shared`, `packages/sdk/src/render.ts`
  (rendering + validation), the dashboard's widget/survey creation forms, and the seed script if
  it should appear in demo data.
- Changing the SDK: rebuild via `npm run build:sdk` before testing against the API or demo site —
  the API serves the compiled `dist/sdk.js`, not the TS source.
- After backend changes, run `npm run test:api` (requires a reachable Postgres — see
  `docker-compose.yml`'s `postgres` service, or point `DATABASE_URL` at a local instance).
- After SDK changes, run `npm run test:sdk`. After dashboard page/component changes, run
  `npm run test:dashboard`. Both run against `vitest`+`jsdom` with no live services required.
- Changes that touch the Definition of Done flow (register → org → project → widget → publish →
  embed → respond → view analytics) should be checked against `npm run test:e2e`
  (`apps/e2e`, Playwright) — it drives that flow through a real browser against a live
  api/dashboard/Postgres.

## Known gaps
See [TODO.md](TODO.md) for the full list. Notably: no Angular/Vue SDK wrappers yet, no third-party
integrations beyond generic webhooks, no AI analysis, no SDK/frontend test suites, and the stack
has not yet been execution-verified end-to-end via `docker compose up`.
