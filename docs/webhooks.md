# Webhooks

Webhooks are the current extension point for reacting to FeedbackHub events outside the dashboard —
they're the architecture Slack/Teams/Zapier-style integrations would build on (see
[TODO.md](../TODO.md); none of those exist yet, only generic webhooks).

## Registering a webhook

`POST /api/v1/webhooks` (admin auth, `webhook:manage` permission):

```json
{ "projectId": "...", "url": "https://example.com/hooks/feedbackhub", "events": ["response.created"] }
```

Response includes the signing `secret` — **shown only this once**, at creation time. Store it; there
is currently no way to retrieve it again (delete and recreate the webhook to get a new one).

Available event types (`WEBHOOK_EVENTS` in `packages/shared`):

- `response.created`
- `response.updated`
- `survey.completed`
- `widget.published`

`PATCH /api/v1/webhooks/:id` updates `url`, `events`, or `active`. `DELETE /api/v1/webhooks/:id`
removes it.

## Payload

```json
{
  "event": "response.created",
  "data": { /* the response object */ },
  "timestamp": "2026-08-12T22:13:39.293Z"
}
```

Sent as `POST` to your `url` with:

```
Content-Type: application/json
X-FeedbackHub-Signature: <hex HMAC-SHA256 of the raw request body, using your webhook secret>
X-FeedbackHub-Event: response.created
```

## Verifying signatures

Compute the HMAC-SHA256 of the **raw** request body using your webhook's secret, and compare against
`X-FeedbackHub-Signature` with a constant-time comparison:

```js
const crypto = require("crypto");

function isValidSignature(rawBody, signatureHeader, secret) {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}
```

Use the raw body bytes, not a re-serialized JSON object — re-serialization can change key order or
whitespace and break the comparison.

## Delivery behavior

- Every active webhook subscribed to an event fires in parallel; one webhook failing doesn't affect
  others or the primary request that triggered the event (`apps/api/src/modules/webhooks/dispatch.ts`
  never throws to its caller).
- Each attempt — success or failure — is recorded in `webhook_deliveries` (status code, payload,
  success flag), but **there is currently no automatic retry** on failure. If your endpoint is down
  when an event fires, that delivery is simply marked unsuccessful.
