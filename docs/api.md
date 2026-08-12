# REST API

Base URL: `{API_BASE_URL}/api/v1` (e.g. `http://localhost:4000/api/v1` locally). Full request/
response schemas are in [`apps/api/openapi.yaml`](../apps/api/openapi.yaml) — served interactively
at `/api/docs` when the API isn't running in production. This page is a map of what's where; see
[authentication.md](authentication.md) for how the two auth mechanisms work.

## Two surfaces

- **Admin API** (`/api/v1/*` except `/public/*`) — everything a logged-in dashboard user can do.
  Requires `Authorization: Bearer <accessToken>`.
- **Public API** (`/api/v1/public/*` and `POST /api/v1/responses`) — everything the embeddable SDK
  calls. Requires a project **public key**, never a user session. This is the only surface a
  browser embedding the SDK ever talks to.

## Route groups

| Path                              | Auth        | Purpose                                                        |
|-------------------------------------|--------------|-------------------------------------------------------------------|
| `POST /auth/register`               | none          | Create a user account, start a session.                          |
| `POST /auth/login`                  | none          | Start a session.                                                  |
| `POST /auth/refresh`                | refresh cookie| Rotate the refresh token, issue a new access token.               |
| `POST /auth/logout`                 | refresh cookie| Revoke the current session.                                       |
| `GET /auth/me`                      | Bearer        | Current user.                                                     |
| `POST /auth/password/forgot`, `/reset` | none / token | Password reset flow (see [authentication.md](authentication.md)). |
| `GET/POST/... /organisations`       | Bearer        | Organisation CRUD and membership.                                 |
| `GET/POST/... /projects`            | Bearer        | Project CRUD within an organisation.                              |
| `GET/POST/... /widgets`             | Bearer        | Widget CRUD, `/publish`, `/unpublish`.                            |
| `GET/POST/... /surveys`             | Bearer        | Survey (multi-question) CRUD, `/publish`.                         |
| `GET /responses`, `/:id`            | Bearer        | List/detail responses for a project.                              |
| `GET /responses/export/:format`     | Bearer        | CSV or JSON export.                                               |
| `POST /responses`                   | **public key**| Submit a response — the only write the SDK performs.              |
| `GET /analytics`                    | Bearer        | Aggregate NPS/rating/volume for a project.                        |
| `GET/POST /api-keys`, `/:id/rotate` | Bearer        | Manage a project's public/secret key pairs.                       |
| `GET/POST/PATCH/DELETE /webhooks`   | Bearer        | Register/manage webhook endpoints (see [webhooks.md](webhooks.md)). |
| `GET /public/config`                | **public key**| Widget definitions for the SDK to render.                          |
| `POST /public/events`               | **public key**| Custom event tracking (`FeedbackHub.track()`).                     |

## Tenant scoping

Every organisation/project-scoped route resolves the requesting user's membership and role before
touching data (`requireProjectPermission` / `requireProjectMembership` / `requireOrgPermission` /
`requireOrgMembership` in `apps/api/src/middleware/tenant.ts`) — a `projectId`/`organisationId` in
the request body or query string is never trusted on its own. See
[authentication.md](authentication.md) for the role/permission table.

## Error format

Errors are JSON with a stable shape:

```json
{ "error": { "code": "NOT_FOUND", "message": "Widget not found or not published" } }
```

Common `code` values: `BAD_REQUEST` (400, including Zod validation failures), `UNAUTHORIZED` (401),
`FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409).

## Rate limiting

Per-route rate limiting is applied via `express-rate-limit`:

| Scope                          | Limit                  |
|----------------------------------|--------------------------|
| General authenticated API        | 600 requests / 15 min    |
| Public surface (`/public/*`, `POST /responses`) | 60 requests / min |
| `/auth/*`                        | 20 requests / 15 min     |

It's currently in-memory (per API process), not Redis-backed — see [TODO.md](../TODO.md).
