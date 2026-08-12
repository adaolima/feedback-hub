# Deployment

`docker-compose.yml` at the repo root is a complete reference deployment — six services: `postgres`,
`redis`, a one-shot `migrate` job, `api`, `dashboard`, and `demo`. This doc covers what to change to
take it from local/dev to production.

## Reference topology

```
postgres (16-alpine)   — persistent volume: postgres_data
redis (7-alpine)       — reserved for future caching/rate-limit use, not yet consumed by the API
migrate                — runs migrations + seed once, then exits; api/dashboard wait for it
api (Express, :4000)   — serves the REST API and /sdk.js
dashboard (Next.js, :3000)
demo (:3001)           — optional; drop this service entirely in production
```

Each app has its own multi-stage Dockerfile in `docker/` (builder stage compiles, runtime stage
copies only build output + production `node_modules`). `docker/api.Dockerfile` builds
`packages/shared` and `packages/sdk` before `apps/api`, since the API depends on both at build and
runtime (serves the compiled `sdk.js` directly, and imports shared types).

## Before going to production

1. **Secrets** — generate strong random values for every secret in `.env` (`JWT_ACCESS_SECRET`,
   `JWT_REFRESH_SECRET`, `SESSION_SECRET`, `POSTGRES_PASSWORD`). The defaults in `.env.example` are
   for local development only — never deploy with them.
2. **`NODE_ENV=production`** on the `api` service — this makes the refresh cookie `Secure` (see
   `apps/api/src/modules/auth/routes.ts`), which requires HTTPS in front of it.
3. **`CORS_ORIGINS`** — restrict to your actual dashboard origin(s). This only governs the
   cookie-authenticated admin API; the public SDK-facing endpoints (`/api/v1/public/*`,
   `POST /responses`) accept any origin by design, since the SDK is meant to be embedded on
   arbitrary customer websites and authenticates via project public key, not a cookie/session
   (`apps/api/src/app.ts`'s `isPublicRoute()` picks CORS policy per-request).
4. **Database** — either keep the bundled `postgres` container (fine for small/self-hosted
   deployments; back up the `postgres_data` volume) or point `DATABASE_URL` at a managed Postgres
   instance and drop the `postgres` service.
5. **Reverse proxy / TLS** — nothing in this repo terminates TLS. Put Nginx, Caddy, or a cloud load
   balancer in front of `api`, `dashboard`, and (if you keep it) `demo`, terminating HTTPS there. An
   Nginx config isn't included yet — see [TODO.md](../TODO.md).
6. **`/sdk.js`** — served directly by the API container; no separate CDN step is required. Fronting
   it with a CDN is a reasonable optimisation once you have real traffic, but isn't necessary to
   ship.
7. **Redis** — the `redis` service runs but isn't wired into anything yet (rate limiting is
   in-memory per API process). If you run multiple API replicas, in-memory rate limits are
   per-replica, not global — acceptable for most self-hosted setups, but worth knowing. See
   [TODO.md](../TODO.md).
8. **Email** — `SMTP_*` env vars are read but nothing sends email yet; password reset tokens are
   logged to the API's stdout instead. Don't rely on the password-reset flow reaching real users
   until this is wired up (see [TODO.md](../TODO.md)) — or wire it up yourself, `apps/api/src/modules/auth/routes.ts`
   is the only place that needs to change.

## Migrations in production

The `migrate` service runs `node apps/api/dist/db/migrate.js && node apps/api/dist/scripts/seed.js`
on every `docker compose up`. **Don't run the seed step against a production database** — it's
demo data. Split the `migrate` service's command to just the migration step in a production compose
override, or run `node apps/api/dist/db/migrate.js` manually as part of your deploy pipeline instead
of relying on the bundled one-shot service.

## Health checks

`postgres` has a Compose healthcheck (`pg_isready`); `api`/`dashboard`/`demo` don't define one in
`docker-compose.yml` today, but the API does expose `GET /health` (outside the `/api/v1` prefix,
returns `{ status: "ok" }`) — wire that into your container orchestrator's health check, and use
`GET /` for the dashboard.
