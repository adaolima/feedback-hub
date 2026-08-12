import crypto from "crypto";
import { query } from "../../db";
import { WebhookEvent } from "@feedbackhub/shared";

/** Signs the payload with HMAC-SHA256 using the webhook's secret, sent as the X-FeedbackHub-Signature header. */
function sign(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

/** Fires all active webhooks subscribed to `event` for the given project. Never throws to callers. */
export async function dispatchWebhook(projectId: string, event: WebhookEvent, payload: unknown): Promise<void> {
  try {
    const webhooks = await query<{ id: string; url: string; secret: string }>(
      `SELECT id, url, secret FROM webhooks WHERE project_id = $1 AND active = true AND $2 = ANY(events)`,
      [projectId, event]
    );

    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });

    await Promise.all(
      webhooks.rows.map(async (webhook) => {
        const signature = sign(webhook.secret, body);
        let statusCode: number | null = null;
        let success = false;
        try {
          const response = await fetch(webhook.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-FeedbackHub-Signature": signature,
              "X-FeedbackHub-Event": event,
            },
            body,
          });
          statusCode = response.status;
          success = response.ok;
        } catch {
          success = false;
        }
        await query(
          `INSERT INTO webhook_deliveries (webhook_id, event, payload, status_code, success)
           VALUES ($1, $2, $3, $4, $5)`,
          [webhook.id, event, body, statusCode, success]
        );
      })
    );
  } catch (err) {
    // Webhook delivery must never break the primary request flow.
    console.error("Webhook dispatch failed:", err);
  }
}
