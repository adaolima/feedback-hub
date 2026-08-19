# FeedbackHub

[![CI](https://github.com/adaolima/feedback-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/adaolima/feedback-hub/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A self-hostable, multi-tenant feedback & survey widget platform — SurveyMonkey-like, but built for
lightweight, contextual feedback embedded directly in your product. Create an organisation, spin up
a project, design a widget or survey, drop a single `<script>` tag on your site, and watch responses
land in a real-time admin dashboard.

FeedbackHub is open source under the [MIT License](LICENSE). Contributions are welcome — see
[CONTRIBUTING.md](CONTRIBUTING.md) for setup, conventions, and the PR process.

## Features

- **Widgets & surveys**: rating, NPS, thumbs up/down, emoji reaction, free text, single choice, and
  multiple choice questions, composable into multi-question surveys with AND-based conditional logic.
- **Flexible embedding**: inline, floating button, bottom bar, or modal display modes; open widgets
  programmatically or target them automatically by URL, time delay, page-view count, custom events,
  exit intent, or display frequency.
- **Multi-tenant by design**: organisations → projects → widgets, with role-based membership checked
  on every request — no tenant's data is ever reachable from another tenant's session.
- **Real admin dashboard**: manage projects, build widgets/surveys visually, browse and export
  responses (CSV/JSON), view analytics (NPS score, ratings distribution, response volume), manage
  API keys, team members, and webhooks.
- **Embeddable JS SDK**: framework-agnostic, renders in a Shadow DOM so host page styles never leak
  in or out, and every public method fails silently — it can never break the page it's embedded in.
- **Framework wrappers**: React (`<FeedbackHubProvider>` + `useFeedback()`), Vue
  (`createFeedbackHub()` plugin + `useFeedback()` composable), and Angular
  (`FeedbackHubModule.forRoot()` + injectable `FeedbackHubService`) — all thin wrappers around the
  same vanilla SDK.
- **Webhooks**: HMAC-SHA256-signed delivery on new responses, the extension point for Slack/Teams/
  Zapier-style integrations.
- **AI-ready schema**: a dedicated `response_analysis` table is already in place for future
  sentiment/topic/priority analysis, without touching the original response data.

## Architecture

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

- **API-first** — the dashboard and SDK only ever talk to the REST API, never the database directly.
- **No ORM** — all database access is raw `pg` with parameterised SQL. Migrations are plain numbered
  `.sql` files in `database/migrations/`, applied by a custom runner and tracked in a
  `schema_migrations` table.
- **Two API surfaces**:
  - Authenticated admin API (`/api/v1/*`) — Bearer access token + rotating refresh-token cookie.
  - Public widget-facing API (`/api/v1/public/*` and `POST /api/v1/responses`) — authenticated via a
    project **public key**, never a user session. This is the only surface the embeddable SDK talks to.
- **Tenant isolation is mandatory** — every project/organisation-scoped route resolves membership via
  `requireProjectPermission` / `requireProjectMembership` / `requireOrgPermission` /
  `requireOrgMembership` before touching any data.

See [PLAN.md](PLAN.md) for the full architecture rationale and [TODO.md](TODO.md) for known gaps.

## Repo layout

```
apps/api/            Express + TypeScript REST API (:4000)
apps/dashboard/       Next.js admin dashboard (:3000)
apps/demo/            Static demo site + tiny Express server (:3001)
packages/shared/      Framework-independent types (QuestionType, roles, NPS calc)
packages/sdk/         Embeddable JS SDK, bundled with esbuild to dist/sdk.js
packages/react/       FeedbackHubProvider + useFeedback wrapper around the SDK
packages/vue/         createFeedbackHub() plugin + useFeedback() composable
packages/angular/     FeedbackHubModule.forRoot() + injectable FeedbackHubService
database/migrations/  Plain numbered .sql files (no ORM), applied by a custom runner
database/seeds/       Pointer to apps/api/src/scripts/seed.ts
docker/                Per-app Dockerfiles
docker-compose.yml    postgres, redis, migrate (one-shot), api, dashboard, demo
```

## Quick start (Docker)

The fastest way to see the whole platform running is Docker Compose — it builds every image, starts
Postgres and Redis, runs migrations, seeds demo data, and boots the API, dashboard, and demo site.

```bash
git clone <this-repo>
cd feedback-system
docker compose up --build
```

Once everything is healthy:

| Service   | URL                     |
|-----------|--------------------------|
| Dashboard | http://localhost:3000    |
| API       | http://localhost:4000    |
| Demo site | http://localhost:3001    |

Log in to the dashboard with the seeded demo account:

```
email:    demo@feedbackhub.dev
password: password123
```

That account already owns an organisation, a project, and four published widgets (rating, NPS,
thumbs, emoji) — open http://localhost:3001 to interact with them live, or check the **Responses**
tab in the dashboard as you submit feedback.

## Local development (without Docker)

Requires Node.js 20+, and a reachable Postgres instance (`docker compose up postgres redis` is the
easiest way to get one without containerising the apps themselves).

```bash
npm install                              # install all workspaces from repo root
cp .env.example apps/api/.env            # then edit DATABASE_URL etc. as needed
npm run migrate --workspace apps/api     # apply DB migrations
npm run seed --workspace apps/api        # seed demo org/project/widgets/responses
npm run build:sdk                        # bundle packages/sdk -> dist/sdk.js (served by the API)

npm run dev:api                          # API dev server (tsx watch), :4000
npm run dev:dashboard                    # Next.js dev server, :3000
npm run dev:demo                         # demo static server, :3001
```

Run the backend integration test suite (needs a live Postgres, applies migrations automatically):

```bash
npm run test:api
```

If you change the SDK, rebuild it (`npm run build:sdk`) before testing — the API serves the compiled
`dist/sdk.js`, not the TypeScript source.

## Environment variables

See [`.env.example`](.env.example) for the full list. The essentials:

| Variable                 | Purpose                                                        |
|---------------------------|-----------------------------------------------------------------|
| `DATABASE_URL`            | Postgres connection string                                     |
| `JWT_ACCESS_SECRET`       | Signs short-lived access tokens                                 |
| `JWT_REFRESH_SECRET`      | Signs/rotates refresh tokens                                     |
| `SESSION_SECRET`          | Session/cookie secret                                            |
| `ACCESS_TOKEN_TTL`        | Access token lifetime (e.g. `15m`)                               |
| `REFRESH_TOKEN_TTL_DAYS`  | Refresh token lifetime in days                                   |
| `FRONTEND_URL`            | Dashboard origin, used for CORS/redirect defaults                |
| `CORS_ORIGINS`            | Comma-separated allow-list for the API                           |
| `REDIS_URL`               | Redis connection (service runs in Compose; not yet wired into rate limiting — see TODO.md) |
| `SMTP_*`                  | Outbound email config (configured, not yet used — see TODO.md)   |

Generate strong random values for every secret in production; the defaults in `.env.example` are for
local development only.

## Embedding the SDK

Add the script tag to any page, pointed at your API's `/sdk.js`, then initialise with a project's
**public key** (visible in the dashboard's API Keys page — safe to expose client-side, unlike the
secret key):

```html
<script>
  window.FeedbackHubConfig = { projectKey: "pk_..." , apiBaseUrl: "https://your-api.example.com" };
</script>
<script src="https://your-api.example.com/sdk.js" async></script>
```

Widgets configured for automatic display (floating, bottom bar) appear on their own once targeting
conditions are met. For inline placement, add a container matched by widget name:

```html
<div data-feedback-widget="Website Rating"></div>
```

Or drive it entirely from code:

```js
FeedbackHub.open("NPS Survey");
FeedbackHub.identify({ userId: "user-123", email: "user@example.com", name: "Jane Doe" });
FeedbackHub.track("checkout_completed");
```

See `apps/demo/public/index.html` for a page exercising every widget type and display mode against
a live API.

### React

```tsx
import { FeedbackHubProvider, useFeedback } from "@feedbackhub/react";

function App() {
  return (
    <FeedbackHubProvider projectKey="pk_..." sdkUrl="https://your-api.example.com/sdk.js">
      <YourApp />
    </FeedbackHubProvider>
  );
}

function FeedbackButton() {
  const feedback = useFeedback();
  return <button onClick={() => feedback.open("NPS Survey")}>Give feedback</button>;
}
```

### Vue

```ts
import { createApp } from "vue";
import { createFeedbackHub, useFeedback } from "@feedbackhub/vue";

const app = createApp(App);
app.use(createFeedbackHub({ projectKey: "pk_...", sdkUrl: "https://your-api.example.com/sdk.js" }));
app.mount("#app");
```

```vue
<script setup lang="ts">
import { useFeedback } from "@feedbackhub/vue";
const feedback = useFeedback();
</script>

<template>
  <button @click="feedback.open('NPS Survey')">Give feedback</button>
</template>
```

### Angular

```ts
import { FeedbackHubModule } from "@feedbackhub/angular";

@NgModule({
  imports: [
    FeedbackHubModule.forRoot({ projectKey: "pk_...", sdkUrl: "https://your-api.example.com/sdk.js" }),
  ],
})
export class AppModule {}
```

```ts
import { FeedbackHubService } from "@feedbackhub/angular";

@Component({ /* ... */ })
export class FeedbackButtonComponent {
  constructor(private feedback: FeedbackHubService) {}
  openSurvey() {
    this.feedback.open("NPS Survey");
  }
}
```

`packages/angular` is compiled with plain `tsc` (decorators enabled), not `ng-packagr` — fine for
JIT/dev consumption in an Angular CLI app, but worth revisiting with a proper Ivy build if this is
ever published to npm.

## API summary

Full request/response schemas live in [`apps/api/openapi.yaml`](apps/api/openapi.yaml). Route groups:

- `auth` — register, login, refresh, logout, current user
- `organisations`, `projects` — tenant hierarchy and membership
- `widgets`, `surveys` — create, update, publish/unpublish
- `responses` — list, detail, CSV/JSON export (admin); `POST /responses` (public, project-key auth)
- `analytics` — aggregate NPS/ratings/volume for a project
- `api-keys` — create and rotate project public/secret key pairs
- `webhooks` — register endpoints, HMAC-signed delivery on new responses
- `public` — `/public/config` (widget definitions for the SDK), `/public/events` (event tracking)

## Deployment

`docker-compose.yml` is a complete reference deployment (Postgres, Redis, one-shot migrate/seed job,
API, dashboard, demo). For production:

- Set all secrets in `.env` to strong random values — never use the `.env.example` defaults.
- Point `DATABASE_URL` at a managed Postgres instance if you're not running the bundled container.
- Set `NODE_ENV=production` and restrict `CORS_ORIGINS` to your actual dashboard/demo origins.
- The API serves `dist/sdk.js` directly — no separate CDN step is required, though fronting it with
  one is a reasonable optimisation for high-traffic sites.
- No reverse proxy (Nginx/Caddy) or TLS termination is bundled — put one in front of `api`,
  `dashboard`, and `demo` in production.

## Status

Phase 1 (auth, orgs, projects, RBAC, schema, dashboard, widgets, SDK, React/Vue/Angular wrappers,
webhooks, backend integration tests) is implemented and has been verified end-to-end via
`docker compose up`. See [TODO.md](TODO.md) for the tracked list of what's left: third-party
integrations beyond generic webhooks, AI-powered response analysis, advanced/nested conditional
logic, and SDK/frontend test suites.

## Contributing

Bug reports, feature requests, and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md)
for the development setup, repo conventions, and PR checklist, and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
for community expectations. Please report security vulnerabilities privately per
[SECURITY.md](SECURITY.md) rather than as a public issue.

## License

[MIT](LICENSE) © Adao Lima
