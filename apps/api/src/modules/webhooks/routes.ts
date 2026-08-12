import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { WEBHOOK_EVENTS } from "@feedbackhub/shared";
import { query } from "../../db";
import { asyncHandler, validateBody } from "../../lib/validate";
import { ApiError } from "../../lib/errors";
import { requireAuth } from "../../middleware/auth";
import { requireProjectMembership, requireProjectPermission } from "../../middleware/tenant";

export const webhooksRouter = Router();
webhooksRouter.use(requireAuth);

webhooksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const projectId = req.query.projectId as string | undefined;
    if (!projectId) throw ApiError.badRequest("projectId query parameter is required");
    req.params.projectId = projectId;
    await new Promise<void>((resolve, reject) => {
      requireProjectMembership()(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    const result = await query(
      `SELECT id, project_id, url, events, active, created_at, updated_at FROM webhooks WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId]
    );
    res.json({ webhooks: result.rows });
  })
);

const createWebhookSchema = z.object({
  projectId: z.string().uuid(),
  url: z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
});

webhooksRouter.post(
  "/",
  validateBody(createWebhookSchema),
  asyncHandler(async (req, res) => {
    const { projectId, url, events } = req.body;
    req.params.projectId = projectId;
    await new Promise<void>((resolve, reject) => {
      requireProjectPermission("webhook:manage")(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    const secret = crypto.randomBytes(24).toString("hex");
    const result = await query(
      `INSERT INTO webhooks (project_id, url, secret, events) VALUES ($1, $2, $3, $4)
       RETURNING id, project_id, url, events, active, created_at, updated_at`,
      [projectId, url, secret, events]
    );
    // Secret is only ever returned at creation time.
    res.status(201).json({ webhook: { ...result.rows[0], secret } });
  })
);

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(),
  active: z.boolean().optional(),
});

webhooksRouter.patch(
  "/:id",
  validateBody(updateWebhookSchema),
  asyncHandler(async (req, res) => {
    const webhook = await query(`SELECT project_id FROM webhooks WHERE id = $1`, [req.params.id]);
    if (webhook.rowCount === 0) throw ApiError.notFound("Webhook not found");
    req.params.projectId = webhook.rows[0].project_id;
    await new Promise<void>((resolve, reject) => {
      requireProjectPermission("webhook:manage")(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    const { url, events, active } = req.body;
    const result = await query(
      `UPDATE webhooks SET
         url = COALESCE($1, url),
         events = COALESCE($2, events),
         active = COALESCE($3, active),
         updated_at = now()
       WHERE id = $4
       RETURNING id, project_id, url, events, active, created_at, updated_at`,
      [url ?? null, events ?? null, active ?? null, req.params.id]
    );
    res.json({ webhook: result.rows[0] });
  })
);

webhooksRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const webhook = await query(`SELECT project_id FROM webhooks WHERE id = $1`, [req.params.id]);
    if (webhook.rowCount === 0) throw ApiError.notFound("Webhook not found");
    req.params.projectId = webhook.rows[0].project_id;
    await new Promise<void>((resolve, reject) => {
      requireProjectPermission("webhook:manage")(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    await query(`DELETE FROM webhooks WHERE id = $1`, [req.params.id]);
    res.status(204).send();
  })
);
