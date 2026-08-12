import { Router } from "express";
import { z } from "zod";
import { query } from "../../db";
import { asyncHandler, validateBody } from "../../lib/validate";
import { ApiError } from "../../lib/errors";
import { requireAuth } from "../../middleware/auth";
import { requireProjectMembership, requireProjectPermission } from "../../middleware/tenant";
import { dispatchWebhook } from "../webhooks/dispatch";

export const widgetsRouter = Router();
widgetsRouter.use(requireAuth);

const WIDGET_TYPES = ["rating", "nps", "thumbs", "emoji", "text", "choice", "multiple_choice", "survey"] as const;

widgetsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const projectId = req.query.projectId as string | undefined;
    if (!projectId) throw ApiError.badRequest("projectId query parameter is required");

    req.params.projectId = projectId;
    await new Promise<void>((resolve, reject) => {
      requireProjectMembership()(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    const result = await query(
      `SELECT id, project_id, survey_id, name, type, config, status, published_at, created_at, updated_at
       FROM widgets WHERE project_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [projectId]
    );
    res.json({ widgets: result.rows });
  })
);

const createWidgetSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(120),
  type: z.enum(WIDGET_TYPES),
  surveyId: z.string().uuid().optional(),
  config: z.record(z.any()).default({}),
});

widgetsRouter.post(
  "/",
  validateBody(createWidgetSchema),
  asyncHandler(async (req, res) => {
    const { projectId, name, type, surveyId, config } = req.body;
    req.params.projectId = projectId;
    await new Promise<void>((resolve, reject) => {
      requireProjectPermission("widget:manage")(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    const result = await query(
      `INSERT INTO widgets (project_id, survey_id, name, type, config)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, project_id, survey_id, name, type, config, status, published_at, created_at, updated_at`,
      [projectId, surveyId ?? null, name, type, JSON.stringify(config)]
    );
    res.status(201).json({ widget: result.rows[0] });
  })
);

widgetsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const widget = await query(
      `SELECT id, project_id, survey_id, name, type, config, status, published_at, created_at, updated_at
       FROM widgets WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (widget.rowCount === 0) throw ApiError.notFound("Widget not found");

    req.params.projectId = widget.rows[0].project_id;
    await new Promise<void>((resolve, reject) => {
      requireProjectMembership()(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    res.json({ widget: widget.rows[0] });
  })
);

const updateWidgetSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  config: z.record(z.any()).optional(),
});

widgetsRouter.patch(
  "/:id",
  validateBody(updateWidgetSchema),
  asyncHandler(async (req, res) => {
    const widget = await query(`SELECT project_id FROM widgets WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
    if (widget.rowCount === 0) throw ApiError.notFound("Widget not found");
    req.params.projectId = widget.rows[0].project_id;
    await new Promise<void>((resolve, reject) => {
      requireProjectPermission("widget:manage")(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    const { name, config } = req.body;
    const result = await query(
      `UPDATE widgets SET
         name = COALESCE($1, name),
         config = COALESCE($2, config),
         updated_at = now()
       WHERE id = $3
       RETURNING id, project_id, survey_id, name, type, config, status, published_at, created_at, updated_at`,
      [name ?? null, config ? JSON.stringify(config) : null, req.params.id]
    );
    res.json({ widget: result.rows[0] });
  })
);

widgetsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const widget = await query(`SELECT project_id FROM widgets WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
    if (widget.rowCount === 0) throw ApiError.notFound("Widget not found");
    req.params.projectId = widget.rows[0].project_id;
    await new Promise<void>((resolve, reject) => {
      requireProjectPermission("widget:manage")(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    await query(`UPDATE widgets SET deleted_at = now() WHERE id = $1`, [req.params.id]);
    res.status(204).send();
  })
);

widgetsRouter.post(
  "/:id/publish",
  asyncHandler(async (req, res) => {
    const widget = await query(`SELECT project_id FROM widgets WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
    if (widget.rowCount === 0) throw ApiError.notFound("Widget not found");
    req.params.projectId = widget.rows[0].project_id;
    await new Promise<void>((resolve, reject) => {
      requireProjectPermission("widget:manage")(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    const result = await query(
      `UPDATE widgets SET status = 'published', published_at = now(), updated_at = now()
       WHERE id = $1
       RETURNING id, project_id, survey_id, name, type, config, status, published_at, created_at, updated_at`,
      [req.params.id]
    );

    await dispatchWebhook(widget.rows[0].project_id, "widget.published", { widget: result.rows[0] });
    res.json({ widget: result.rows[0] });
  })
);

widgetsRouter.post(
  "/:id/unpublish",
  asyncHandler(async (req, res) => {
    const widget = await query(`SELECT project_id FROM widgets WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
    if (widget.rowCount === 0) throw ApiError.notFound("Widget not found");
    req.params.projectId = widget.rows[0].project_id;
    await new Promise<void>((resolve, reject) => {
      requireProjectPermission("widget:manage")(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    const result = await query(
      `UPDATE widgets SET status = 'draft', updated_at = now() WHERE id = $1
       RETURNING id, project_id, survey_id, name, type, config, status, published_at, created_at, updated_at`,
      [req.params.id]
    );
    res.json({ widget: result.rows[0] });
  })
);
