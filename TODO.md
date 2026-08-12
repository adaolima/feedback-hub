# TODO — Remaining Work

Tracking gaps against the full spec in [PLAN.md](PLAN.md). Nothing here blocks the core
Definition of Done flow (register → org → project → widget → publish → embed → respond → view
analytics), but all of it is expected for a "complete" implementation.

## Verification (do this first)
- [x] Run `npm install` at the repo root and confirm all workspaces resolve.
- [x] Run `docker compose up` end-to-end: postgres → migrate → seed → api → dashboard → demo.
      Found and fixed real bugs along the way (see below) — all five containers are now healthy.
- [x] Walk the Definition of Done flow via API calls (login, fetch public widget config, submit a
      response via the public API, confirm it appears in the authenticated responses inbox).
      Not yet walked manually in an actual browser — do that before calling this fully done.
- [x] Run `npm run test:api` against a live Postgres and confirm all tests pass (9/9 passing).
- [x] Build the SDK (`npm run build:sdk`) and confirm `/sdk.js` is served by the API (200 OK) and
      the demo site references it.

### Bugs found and fixed during verification
- `packages/shared` was never built by any root script (`main`/`types` pointed at a missing
  `dist/`), so `apps/api` failed to build outside Docker (`Cannot find module '@feedbackhub/shared'`)
  and would have failed at runtime too. Added `build:shared` to root `package.json` and chained it
  into `dev:api` / `test:api`.
- `apps/api/src/db/index.ts`: `query<T>()` didn't constrain `T extends QueryResultRow`, failing
  `tsc` under current `@types/pg`.
- `apps/api/src/lib/tokens.ts`: `jwt.sign(..., { expiresIn: env.accessTokenTtl })` failed to
  typecheck under current `@types/jsonwebtoken` (`expiresIn` wants `number | StringValue`, not
  plain `string`). Cast at the call site since the env var is admin-configured, not user input.
- `packages/sdk/src/storage.ts` + `index.ts`: `saveIdentity`/`loadIdentity` were typed as
  `Record<string, unknown>` instead of `Identity`, breaking `tsc --emitDeclarationOnly`.
- `packages/sdk/src/render.ts`: `collectedAnswers` was typed as the optional `SubmitPayload["answers"]`
  (`Array | undefined`) instead of a non-nullable array, so `.push()` failed to typecheck.
- `docker/dashboard.Dockerfile`: runtime `CMD` referenced `node_modules/.bin/next` relative to
  `WORKDIR /repo/apps/dashboard`, but npm workspaces hoist `node_modules` to `/repo/node_modules`,
  so the dashboard container crash-looped on every start (`Cannot find module
  '/repo/apps/dashboard/node_modules/.bin/next'`). Fixed to the absolute hoisted path.

## Documentation
- [x] Write the top-level `README.md` (what is FeedbackHub, features, architecture, quick start,
      Docker setup, env vars, SDK/React integration, API summary, deployment). Angular/Vue
      integration sections deferred until those wrappers exist (tracked below).
- [x] `docs/getting-started.md`
- [x] `docs/sdk.md`
- [x] `docs/react.md`
- [x] `docs/angular.md`
- [x] `docs/vue.md`
- [x] `docs/api.md`
- [x] `docs/authentication.md`
- [x] `docs/webhooks.md`
- [x] `docs/deployment.md`

## Framework integrations (Phase 2)
- [x] `packages/angular` — injectable `FeedbackHubService` wrapper, provided via
      `FeedbackHubModule.forRoot(options)`. Compiled with plain `tsc` (decorators enabled), not
      `ng-packagr` — fine for JIT/dev consumption, worth revisiting if this is ever published to npm.
- [x] `packages/vue` — `createFeedbackHub(options)` plugin (`app.use(...)`) + `useFeedback()`
      composable, mirroring `packages/react`'s provider/hook shape.
- [ ] Next.js-specific integration notes/example (App Router client component pattern).
- [ ] `packages/react-native` — no SDK exists for React Native today, and `packages/react` cannot
      be reused as-is: `packages/sdk` depends on browser-only APIs (`document`, `window`, `<script>`
      tag injection, Shadow DOM widget rendering, `localStorage`/`sessionStorage`), none of which
      exist in RN's JS runtime. Needs its own widget renderer built on RN primitives (View/Modal/
      etc.) rather than a thin wrapper, plus RN-appropriate persistence (e.g. `AsyncStorage`) in
      place of the web storage APIs.

## Third-party integrations (Phase 3, architecture only exists via webhooks today)
- [ ] Slack notification integration
- [ ] Microsoft Teams integration
- [ ] Email notification integration (SMTP is configured but unused)
- [ ] Zapier / Make integration docs
- [ ] HubSpot / Salesforce / Jira / Linear — interface stubs only

## Analytics & targeting (Phase 3)
- [ ] Advanced/nested conditional logic (currently AND-only, single-level)
- [ ] Additional targeting rules: returning users, identified-only enforcement in SDK gating
      (currently stored in config but not fully enforced client-side)
- [ ] Segmentation by user/device/country in the analytics UI (API already accepts some filters
      server-side; dashboard UI doesn't expose all of them yet)
- [ ] NPS trend-over-time chart in dashboard (data available via `/analytics`, chart not built)

## AI-ready features (Phase 3)
- [ ] Sentiment/topic/category/summary/priority generation into `response_analysis`
- [ ] Surface `response_analysis` in the Response Detail view

## Testing gaps
- [ ] SDK unit tests (init, widget rendering, identity, targeting, frequency limits, API failure
      handling)
- [ ] Dashboard frontend tests (login, survey builder, widget config, response viewing)
- [ ] A scripted end-to-end test (Playwright or similar) covering the full Definition of Done flow

## Known bugs
- [x] **Public API CORS was broken for real deployments.** `apps/api/src/app.ts` applied a single
      global `cors({ origin: env.corsOrigins })` allow-list to every route, including
      `/api/v1/public/*` and `POST /api/v1/responses` — the endpoints the embeddable SDK calls from
      *arbitrary customer websites*. In production, any customer domain not explicitly listed in
      `CORS_ORIGINS` would have had the SDK's requests blocked by the browser (curl-based smoke
      tests didn't catch this since curl doesn't enforce CORS). **Fixed**: `app.ts` now picks CORS
      options per-request via `isPublicRoute()` — the public surface gets `origin: true` (reflects
      any origin) with `credentials: false`, since public-key auth doesn't rely on cookies; the
      cookie-authenticated admin API keeps the strict `CORS_ORIGINS` allow-list +
      `credentials: true`. Verified with real preflight (OPTIONS) requests from an arbitrary
      origin: public routes now return `Access-Control-Allow-Origin` for any origin, admin routes
      still omit it for origins outside the allow-list.

## Nice-to-haves not yet done
- [ ] Email verification flow wired to real SMTP sending (token generation exists, no email sent)
- [ ] Audit log writes (table exists, nothing writes to it yet)
- [ ] Nginx reverse proxy config (optional per spec, not created)
- [ ] Redis actually used for caching/rate-limit storage (service runs in Docker Compose but the
      API's rate limiter is in-memory, not Redis-backed)
