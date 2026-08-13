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
- [x] Next.js-specific integration notes/example (App Router client component pattern) — added to
      [`docs/react.md`](docs/react.md): a `Providers` client component wrapping
      `FeedbackHubProvider`, kept out of the (Server Component) root layout, plus `NEXT_PUBLIC_*`
      env var wiring.
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
- [x] **Cross-Origin-Resource-Policy also blocked every cross-origin load, independent of CORS.**
      `helmet()`'s default `Cross-Origin-Resource-Policy: same-origin` header made the browser
      block `/sdk.js` (and every JSON response) when loaded from a different origin — a separate
      check from CORS, not fixed by the CORS change above. This is what actually broke the demo
      site (`net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin` in the console, `FeedbackHub is not
      defined` since the script never loaded) and would have broken the dashboard's real
      browser traffic too, despite curl-based smoke tests passing (CORP, like CORS, is
      browser-only enforcement). **Fixed**: `helmet({ crossOriginResourcePolicy: { policy:
      "cross-origin" } })` in `apps/api/src/app.ts` — appropriate globally since every response
      from this API is meant to be consumed cross-origin by design (dashboard, demo site, and
      arbitrary customer sites are all separate origins from the API). CORS remains the actual
      access-control mechanism and is unaffected by this change.
- [x] **Seeded demo widgets used production-appropriate frequency caps, which hid them on repeat
      demo visits.** `apps/api/src/scripts/seed.ts` seeded "Website Rating" and "Emoji Reaction"
      with `frequency: "once_per_session"` and "NPS Survey" with `frequency: "every_30_days"` —
      sensible for a real deployment (don't nag the same visitor repeatedly) but wrong for the demo
      site, whose entire purpose is showcasing every widget on every visit. After the CORS/CORP
      fixes above started letting the SDK actually load and run, repeated reloads while testing
      triggered these caps, so "a few areas" stopped showing widgets — working as designed, just
      configured for the wrong context. **Fixed**: seed data now uses `frequency: "always"` for all
      four demo widgets; also patched directly into the already-seeded rows in the running database
      (`UPDATE widgets SET config = jsonb_set(...)`) so the fix took effect without a destructive
      reseed. The frequency-capping feature itself is untouched — only the demo's own seed config
      changed.
- [x] **"Rating" question type had no star UI.** `packages/sdk/src/render.ts`'s `rating` case only
      ever rendered a row of numbered buttons (1..max) — `WidgetAppearance.iconStyle` existed in
      `packages/shared` but was never read anywhere, so there was no way to get an actual star
      rating even though that's the near-universal convention for this widget type. **Fixed**:
      the rating renderer now shows clickable ★/☆ stars with a hover-fill preview, replacing the
      numbered buttons; submit payload shape (`{ rating, answers }`) is unchanged.
- [x] **`identify()`'s `userId` was modeled as a FeedbackHub account, not an external user id.**
      `responses.user_id` and `events.user_id` were `UUID REFERENCES users(id)` — a foreign key to
      FeedbackHub's own *dashboard login accounts*. But `FeedbackHub.identify({ userId })` is meant
      to carry the *host website's own* end-user id (an arbitrary string from the customer's own
      system, e.g. `"demo-user-1"` or `"cus_12345"` — never a FeedbackHub account). As shipped, any
      `identify()` call with a non-UUID id (the common case) made every subsequent response
      submission or tracked event fail Zod's `z.string().uuid()` outright; even a UUID-shaped id
      would've violated the FK unless it happened to match a real dashboard user. This is what broke
      the demo's "Identify as demo user" → "Track: checkout_completed" flow.
      **Fixed**: new migration `database/migrations/0002_external_user_id_as_text.sql` drops both
      FKs and widens the columns to free-form `TEXT`, consistent with how `anonymous_id`/
      `session_id` were already modeled; the two Zod schemas (`responses/routes.ts`,
      `public/routes.ts`) now accept any string up to 255 chars instead of requiring a UUID.
      Verified end-to-end with curl reproducing the exact demo sequence (non-UUID `userId` on both
      a tracked event and a response submission); full test suite still passes (9/9).
- [x] **No seeded widget was configured to react to a tracked event**, even though the demo's own
      copy says tracking a product event "can trigger targeted surveys." `FeedbackHub.track()`'s
      event-triggering logic (`checkEventTriggers` in `packages/sdk/src/index.ts`) was correct, but
      none of the seed widgets had `targeting.events` set, so clicking "Track: checkout_completed"
      never visibly did anything even once the request itself started succeeding. **Fixed**: seed's
      "NPS Survey" widget now includes `events: ["checkout_completed"]`, so tracking that event
      opens the survey immediately, in addition to its existing delayed floating button. Patched
      into the live database directly (`jsonb_set` on the seeded row) in addition to the seed
      source change.
- [x] **The seeded survey was never reachable — no way to view a survey response existed.**
      `seed.ts` created the "Post-Checkout Survey" directly in the `surveys` table but never
      wrapped it in a `widgets` row; `/public/config` only ever returns `widgets`, so the SDK could
      never display or accept a submission for it — only the dashboard's Surveys (build/publish)
      page could see it existed. Separately, even where a survey response *did* exist,
      `GET /api/v1/responses/:id` already returned per-question `answers` (joined from
      `response_answers`) and the dashboard's `FeedbackResponse` type already declared that field,
      but the Response Detail modal (`apps/dashboard/src/app/(app)/responses/page.tsx`) never
      rendered it. **Fixed**: `seed.ts` now inserts a `type: 'survey'` widget (`modal` display mode)
      wrapping the seeded survey, plus one sample survey response with two `response_answers` rows;
      the Response Detail modal now renders `selected.answers` (type + value per question). Also
      added a "Open post-checkout survey" trigger button to the demo site. Patched the equivalent
      rows directly into the running database. Verified via curl: `/public/config` now returns the
      survey widget with all 3 questions attached, and `GET /responses/:id` returns both answers;
      full test suite still passes (9/9).
- [x] **Survey answers showed raw option value codes, not the labels the respondent saw, and no
      question text.** `GET /api/v1/responses/:id` returned each answer as bare
      `{ question_id, type, value }` — no join back to `survey_questions` for the question's title,
      and for `choice`/`multiple_choice` answers `value` is the raw selected option `value`
      string(s) (e.g. `["blue"]`), not the human-readable `label`. The dashboard's Response Detail
      modal rendered this as-is (`JSON.stringify` for arrays), so a multi-select answer showed as a
      value-slug array instead of the actual chosen options. **Fixed**: the endpoint now joins
      `survey_questions` for `question_title` and, for choice-type answers, resolves each selected
      value against `survey_options` into an `optionLabels` array; the dashboard renders
      `question_title` as the label and `optionLabels.join(", ")` when present. Also fixed the seed
      sample survey response, which was itself incomplete — missing the NPS follow-up answer even
      though its conditional logic (rating ≤ 3) was satisfied, and had a `null` `question_id` on
      the text answer where a real SDK submission always attaches one
      (`packages/sdk/src/render.ts`'s `renderSurvey`). Verified via curl: all 3 answers now return
      with correct `question_id`/`question_title`, in question order; full test suite still passes
      (9/9).
- [x] **No in-panel instructions for React/Vue/Angular integration.** The dashboard's "Embed code"
      modal (Widgets page) and the onboarding wizard's finish step only ever showed a vanilla-JS
      `<script>` snippet; `docs/react.md`/`docs/vue.md`/`docs/angular.md` existed only as repo
      markdown, never surfaced anywhere in the running app. Also, the embed modal was showing a
      hardcoded `"pk_your_public_key"` placeholder instead of the project's real public key.
      **Fixed**: added `EmbedFramework`-aware snippet builders to `lib/widgetDefaults.ts`
      (`buildReactSnippet`/`buildVueSnippet`/`buildAngularSnippet`, alongside the existing
      `buildEmbedSnippet` for vanilla JS) and a shared `components/EmbedSnippet.tsx` tab switcher,
      used by both the Widgets page's embed modal and the onboarding wizard's finish step. The
      Widgets page now fetches the project's real public key (reusing the same
      find-existing-or-none pattern as the wizard) and shows a link to API Keys instead of a fake
      key when none exists yet.
- [x] **Onboarding wizard re-triggered based on a heuristic ("zero organisations"), not genuine
      first access.** The `(app)` layout redirected any signed-in user with zero organisations to
      `/onboarding` — which meant an *existing* user who later left their only organisation would
      incorrectly be routed through the new-user wizard again, and there was no way to distinguish
      "never onboarded" from "currently org-less for an unrelated reason." **Fixed**: added a
      persisted `users.onboarded_at` column (`database/migrations/0003_users_onboarded_at.sql`) and
      `POST /api/v1/auth/onboarding-complete` (idempotent: `COALESCE(onboarded_at, now())`), called
      by the wizard right after it successfully creates the first widget — deliberately last, so a
      failure earlier in the flow doesn't mark a half-finished setup as complete. The layout redirect
      now checks `user.onboarded_at` instead of organisation count, so it fires exactly once, on
      real first access, and never again regardless of later org membership changes. Backfilled via
      a second migration (`0004_backfill_onboarded_at.sql`, kept separate since `0003` was already
      applied) so existing accounts with at least one organisation aren't incorrectly sent through
      onboarding on their next login. Verified via curl: `onboarded_at` is `null` right after
      register, gets set by the completion call, survives a subsequent login unchanged, and the
      seeded demo account plus other pre-existing test accounts were correctly backfilled. Full test
      suite still passes (9/9).

## Nice-to-haves not yet done
- [ ] Email verification flow wired to real SMTP sending (token generation exists, no email sent)
- [ ] Audit log writes (table exists, nothing writes to it yet)
- [ ] Nginx reverse proxy config (optional per spec, not created)
- [ ] Redis actually used for caching/rate-limit storage (service runs in Docker Compose but the
      API's rate limiter is in-memory, not Redis-backed)
