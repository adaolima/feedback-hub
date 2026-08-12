# FeedbackHub — Implementation Plan

## 1. Product Summary
FeedbackHub is a self-hostable, multi-tenant feedback & survey widget platform. Companies create
organisations → projects → widgets/surveys, publish them, embed a single `<script>` tag on their
site via the FeedbackHub SDK, and view responses/analytics in an admin dashboard.

## 2. Architecture

```
Host Website / App          Admin Dashboard (Next.js, :3000)
      │  <script>                    │  fetch (Bearer + refresh cookie)
      ▼                              ▼
FeedbackHub SDK (packages/sdk)  ──►  FeedbackHub API (Express + TS, :4000)
  - Widget renderer (Shadow DOM)          │
  - Event tracker                         ▼
  - Identity manager                 PostgreSQL (raw SQL migrations, no ORM)
  - Targeting engine
  - API client (project public key)
```

- **API-first**: dashboard and SDK only talk to the REST API, never the DB directly.
- **SDK independence**: `packages/sdk` has zero dependency on the dashboard; `packages/react` is a
  thin optional wrapper around it.
- **Framework independence**: widget rendering logic lives in the core SDK; React/Angular/Vue are
  wrappers only.
- **Modular backend**: `auth`, `organisations`, `projects`, `widgets`, `surveys`, `responses`,
  `analytics`, `apiKeys`, `webhooks`, `public` are independent route modules sharing `db`, `lib`,
  and `middleware`.
- **Extensibility**: `QuestionType` is a closed union today (`rating | nps | thumbs | emoji | text |
  choice | multiple_choice`) but every question/answer is stored as JSONB `config`/`value`, so new
  types (`ranking`, `matrix`, `file_upload`) only require adding to the union + a renderer case, not
  a schema migration.
- **AI-ready**: `response_analysis` is a separate 1:1 table so sentiment/topic/priority metadata can
  be added later without touching the original `responses` row.

## 3. Monorepo Structure

```
feedbackhub/
├── apps/
│   ├── dashboard/   Next.js admin dashboard (:3000)
│   ├── api/         Express + TypeScript REST API (:4000)
│   └── demo/        Static demo site + tiny Express server (:3001)
├── packages/
│   ├── shared/      Framework-independent types (QuestionType, roles, NPS calc, ...)
│   ├── sdk/         Vanilla JS/TS embeddable SDK, bundled to dist/sdk.js via esbuild
│   ├── react/       FeedbackHubProvider + useFeedback wrapper around the SDK
│   ├── angular/     FeedbackHubModule.forRoot() + injectable FeedbackHubService wrapper
│   └── vue/         createFeedbackHub() plugin + useFeedback() composable
├── database/
│   ├── migrations/  Plain numbered .sql files, applied by a custom runner (no ORM)
│   └── seeds/       Pointer to apps/api/src/scripts/seed.ts (needs password hashing)
├── docker/          Per-app Dockerfiles (multi-stage)
├── docker-compose.yml
└── .env.example
```

## 4. Database Schema (implemented)
`users`, `organisations`, `organisation_members`, `projects`, `api_keys`, `surveys`,
`survey_questions`, `survey_options`, `widgets`, `responses`, `response_answers`,
`response_analysis` (AI-ready, empty until AI phase), `events`, `sessions` (refresh tokens),
`password_reset_tokens`, `email_verification_tokens`, `webhooks`, `webhook_deliveries`,
`audit_logs`. All public IDs are UUIDs; soft-deletable tables carry `deleted_at`.

## 5. API Boundaries
- **Authenticated admin API** (`/api/v1/*`, Bearer access token + rotating refresh-token cookie):
  auth, organisations, projects, widgets, surveys, responses (list/detail/export), analytics,
  api-keys, webhooks.
- **Public widget-facing API** (`/api/v1/public/*` + `POST /api/v1/responses`): authenticated via a
  project **public key**, never a user session. Used exclusively by the SDK.
- Every project-scoped route resolves the owning organisation and checks
  `organisation_members.role` via `roleHasPermission()` before touching data — this is the
  tenant-isolation guard (`middleware/tenant.ts`).

## 6. Security Considerations
- Argon2id password hashing; opaque rotating refresh tokens (hash-only in DB); short-lived JWT
  access tokens; HTTP-only, SameSite=Lax refresh cookie.
- All SQL is parameterised (`$1, $2...`) — no string-built queries.
- `helmet`, CORS allow-list, per-route rate limiting (stricter on `/auth` and public endpoints).
- Secrets (API secret keys, webhook secrets) are hashed/shown once; only public keys are safe to
  embed client-side.
- Webhook payloads are HMAC-SHA256 signed; delivery failures are swallowed so they can never break
  the primary request.
- SDK never throws into the host page: every public method and network call is wrapped in
  try/catch and fails silently (optionally logged via `debug: true`).

## 7. MVP vs. Future Work
**Implemented (Phase 1 + parts of Phase 2):** auth, orgs, projects, RBAC, Postgres schema +
migrations, dashboard shell (auth, projects, widgets, surveys, responses inbox/detail, analytics,
API keys, webhooks/integrations, team, settings), rating/NPS/thumbs/emoji/text/choice/multiple
choice widgets, survey builder with simple AND conditional logic, JS SDK with Shadow DOM rendering,
targeting (URL/delay/event/frequency/exit-intent), CSV/JSON export, webhooks, OpenAPI docs, Docker
Compose, seed data, integration tests (auth, tenant isolation, CRUD, responses, analytics, api
keys, webhooks), React/Angular/Vue framework wrappers around the SDK.

**Not yet implemented (documented as future work, architecture allows it):**
- Slack/Teams/email/Zapier integrations (webhooks provide the extension point).
- AI-powered sentiment/topic analysis (schema is ready via `response_analysis`).
- Advanced segmentation and nested/OR conditional logic (current model is AND-only by design).
- SDK/frontend automated test suites (only backend integration tests exist today).

## 8. Definition of Done (validated manually)
`docker compose up` → migrate/seed run automatically → register on dashboard → create org/project →
create + publish an NPS widget → copy embed snippet → open demo site → submit a response →
response is persisted in Postgres → visible in Responses inbox and Analytics without any manual
DB manipulation.
