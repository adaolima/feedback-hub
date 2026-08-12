# TODO — Remaining Work

Tracking gaps against the full spec in [PLAN.md](PLAN.md). Nothing here blocks the core
Definition of Done flow (register → org → project → widget → publish → embed → respond → view
analytics), but all of it is expected for a "complete" implementation.

## Verification (do this first)
- [ ] Run `npm install` at the repo root and confirm all workspaces resolve.
- [ ] Run `docker compose up` end-to-end: postgres → migrate → seed → api → dashboard → demo.
- [ ] Manually walk the Definition of Done flow in a browser.
- [ ] Run `npm run test:api` against a live Postgres and confirm all tests pass.
- [ ] Build the SDK (`npm run build:sdk`) and confirm `/sdk.js` is served by the API and renders
      widgets on the demo site.

## Documentation
- [ ] Write the top-level `README.md` (what is FeedbackHub, features, architecture, quick start,
      Docker setup, env vars, SDK/React/Angular/Vue integration, API summary, deployment).
- [ ] `docs/getting-started.md`
- [ ] `docs/sdk.md`
- [ ] `docs/react.md`
- [ ] `docs/angular.md`
- [ ] `docs/vue.md`
- [ ] `docs/api.md`
- [ ] `docs/authentication.md`
- [ ] `docs/webhooks.md`
- [ ] `docs/deployment.md`

## Framework integrations (Phase 2)
- [ ] `packages/angular` — injectable `FeedbackHubService` wrapper.
- [ ] `packages/vue` — composable (`useFeedback`) + plugin wrapper.
- [ ] Next.js-specific integration notes/example (App Router client component pattern).

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

## Nice-to-haves not yet done
- [ ] Email verification flow wired to real SMTP sending (token generation exists, no email sent)
- [ ] Audit log writes (table exists, nothing writes to it yet)
- [ ] Nginx reverse proxy config (optional per spec, not created)
- [ ] Redis actually used for caching/rate-limit storage (service runs in Docker Compose but the
      API's rate limiter is in-memory, not Redis-backed)
