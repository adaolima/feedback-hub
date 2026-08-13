# Authentication

FeedbackHub has two independent auth mechanisms, matching the two API surfaces described in
[api.md](api.md). Never mix them: admin routes never accept a project key, and public/SDK routes
never accept or require a user session.

## Admin (dashboard) auth

Session-based, using a short-lived JWT access token plus a rotating opaque refresh token.

1. `POST /auth/register` or `POST /auth/login` returns `{ user, accessToken }` and sets an
   HTTP-only, `SameSite=Lax` refresh cookie (`fh_refresh_token`, scoped to `/api/v1/auth`).
2. Every subsequent admin request sends `Authorization: Bearer <accessToken>`.
3. When the access token expires (`ACCESS_TOKEN_TTL`, default `15m`), call `POST /auth/refresh` —
   it reads the refresh cookie, verifies the session hasn't been revoked or expired, **rotates** it
   (the old session is revoked, a brand new refresh token is issued), and returns a fresh access
   token.
4. `POST /auth/logout` revokes the current session and clears the cookie.

Passwords are hashed with Argon2id (`apps/api/src/lib/password.ts`). Refresh tokens, password reset
tokens, and secret API keys are never stored in plaintext — only their SHA-256 hash
(`apps/api/src/lib/tokens.ts`); the plaintext value is returned to the client exactly once, at
creation/rotation time.

### Onboarding

`users.onboarded_at` (nullable, set once) tracks whether a user has completed the dashboard's
onboarding wizard. It's `null` for a brand-new registration; the dashboard's `(app)` layout
redirects to `/onboarding` whenever it's `null` and never again once set —
`POST /auth/onboarding-complete` (`COALESCE(onboarded_at, now())`, idempotent) is called by the
wizard itself right after it successfully creates the user's first widget. This is deliberately a
persisted flag rather than derived from current state (e.g. "has zero organisations") so it reflects
genuine first access — an existing user who later leaves their only organisation isn't routed back
through new-user onboarding.

### Password reset

`POST /auth/password/forgot` always returns `200 { ok: true }` regardless of whether the email
exists, to avoid leaking account existence. If it does exist, an opaque token is generated,
hashed and stored with a 1-hour expiry — in local/dev it's logged to the API console (`console.log`)
instead of emailed, since SMTP sending isn't wired up yet (see [TODO.md](../TODO.md)).
`POST /auth/password/reset` consumes that token, updates the password, and revokes every existing
session for that user.

### Roles and permissions

Membership in an organisation carries one role, checked on every project/organisation-scoped route
via `apps/api/src/middleware/tenant.ts`:

| Role     | Permissions                                                                 |
|------------|--------------------------------------------------------------------------------|
| `OWNER`    | Everything (`*`).                                                              |
| `ADMIN`    | Org/project/widget/survey/user/api-key/webhook management, response + analytics read. |
| `MEMBER`   | Project/widget/survey management, response + analytics read.                   |
| `VIEWER`   | Response + analytics read only.                                                |

A route never trusts a `projectId`/`organisationId` from the request body/query on its own — it's
always resolved and checked against `organisation_members` first.

## Public (SDK) auth

The embeddable SDK never has a user session. It authenticates with a project's **public key**
(`pk_...`), sent as `X-Project-Key` header, or `projectKey` in the request body/query
(`apps/api/src/lib/publicAuth.ts`). The public key resolves to a `projectId`/`organisationId`
server-side — it is never used to bypass tenant checks, just to identify which project's widgets to
serve or which project a response belongs to.

Public keys are safe to embed client-side by design — they can only read published widget config and
submit responses/events, nothing else. **Secret keys** (`sk_...`, used for future server-to-server
integrations) must never be exposed to a browser; they're only ever shown once, at creation/rotation
time, and stored hashed thereafter (see `apps/api/src/modules/apiKeys/routes.ts`).

## Rotating keys and secrets

- API keys: `POST /api-keys/:id/rotate` revokes the old key and issues a new one atomically. Update
  any embed snippet or server integration before the old key's traffic starts failing.
- Webhook secrets: shown once at creation (`POST /webhooks`); there's currently no rotate endpoint
  for an existing webhook — delete and recreate it to get a new secret.
