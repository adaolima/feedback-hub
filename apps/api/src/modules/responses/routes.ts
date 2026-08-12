import { Router } from "express";
import { z } from "zod";
import { NPS_CATEGORY } from "@feedbackhub/shared";
import { query } from "../../db";
import { asyncHandler, validateBody } from "../../lib/validate";
import { ApiError } from "../../lib/errors";
import { requireAuth } from "../../middleware/auth";
import { requireProjectMembership } from "../../middleware/tenant";
import { publicRateLimiter } from "../../middleware/rateLimit";
import { extractProjectKey, resolveProjectByPublicKey } from "../../lib/publicAuth";
import { buildDeviceContext } from "../../lib/deviceContext";
import { dispatchWebhook } from "../webhooks/dispatch";

export const responsesRouter = Router();

/** Public: create a response. Authenticated via project public key, not a user session. */
const createResponseSchema = z.object({
  projectKey: z.string().min(1),
  widgetId: z.string().uuid(),
  surveyId: z.string().uuid().optional(),
  anonymousId: z.string().max(120).optional(),
  sessionId: z.string().max(120).optional(),
  userId: z.string().max(255).optional(), // the host site's own end-user id, not a FeedbackHub account
  rating: z.number().int().min(0).max(10).optional(),
  npsScore: z.number().int().min(0).max(10).optional(),
  feedbackText: z.string().max(10000).optional(),
  pageUrl: z.string().max(2000).optional(),
  pageTitle: z.string().max(500).optional(),
  referrer: z.string().max(2000).optional(),
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid().optional(),
        type: z.string(),
        value: z.any(),
      })
    )
    .default([]),
});

responsesRouter.post(
  "/",
  publicRateLimiter,
  validateBody(createResponseSchema),
  asyncHandler(async (req, res) => {
    const projectKey = extractProjectKey(req) ?? req.body.projectKey;
    const { projectId } = await resolveProjectByPublicKey(projectKey);

    const widget = await query<{ id: string; project_id: string }>(
      `SELECT id, project_id FROM widgets WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL AND status = 'published'`,
      [req.body.widgetId, projectId]
    );
    if (widget.rowCount === 0) throw ApiError.notFound("Widget not found or not published");

    const metadata = buildDeviceContext(req, req.body);

    const response = await query(
      `INSERT INTO responses (project_id, widget_id, survey_id, user_id, anonymous_id, session_id, rating, nps_score, feedback_text, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        projectId,
        req.body.widgetId,
        req.body.surveyId ?? null,
        req.body.userId ?? null,
        req.body.anonymousId ?? null,
        req.body.sessionId ?? null,
        req.body.rating ?? null,
        req.body.npsScore ?? null,
        req.body.feedbackText ?? null,
        JSON.stringify(metadata),
      ]
    );

    const responseRow = response.rows[0];

    for (const answer of req.body.answers) {
      await query(
        `INSERT INTO response_answers (response_id, question_id, type, value) VALUES ($1, $2, $3, $4)`,
        [responseRow.id, answer.questionId ?? null, answer.type, JSON.stringify(answer.value)]
      );
    }

    await dispatchWebhook(projectId, "response.created", { response: responseRow });
    if (req.body.surveyId) {
      await dispatchWebhook(projectId, "survey.completed", { surveyId: req.body.surveyId, responseId: responseRow.id });
    }

    res.status(201).json({ response: responseRow });
  })
);

/** Authenticated: paginated response inbox for a project, with filters. */
responsesRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const projectId = req.query.projectId as string | undefined;
    if (!projectId) throw ApiError.badRequest("projectId query parameter is required");
    req.params.projectId = projectId;
    await new Promise<void>((resolve, reject) => {
      requireProjectMembership()(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    const page = Math.max(parseInt((req.query.page as string) ?? "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt((req.query.pageSize as string) ?? "25", 10), 1), 100);
    const offset = (page - 1) * pageSize;

    const filters: string[] = ["project_id = $1"];
    const params: any[] = [projectId];

    if (req.query.widgetId) {
      params.push(req.query.widgetId);
      filters.push(`widget_id = $${params.length}`);
    }
    if (req.query.minRating) {
      params.push(parseInt(req.query.minRating as string, 10));
      filters.push(`rating >= $${params.length}`);
    }
    if (req.query.npsCategory) {
      const category = req.query.npsCategory as string;
      if (category === "promoter") filters.push(`nps_score >= 9`);
      if (category === "passive") filters.push(`nps_score BETWEEN 7 AND 8`);
      if (category === "detractor") filters.push(`nps_score <= 6`);
    }
    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      filters.push(`feedback_text ILIKE $${params.length}`);
    }
    if (req.query.from) {
      params.push(req.query.from);
      filters.push(`created_at >= $${params.length}`);
    }
    if (req.query.to) {
      params.push(req.query.to);
      filters.push(`created_at <= $${params.length}`);
    }

    const where = filters.join(" AND ");
    const countResult = await query(`SELECT COUNT(*) FROM responses WHERE ${where}`, params);
    params.push(pageSize, offset);
    const result = await query(
      `SELECT * FROM responses WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      responses: result.rows,
      pagination: {
        page,
        pageSize,
        total: parseInt(countResult.rows[0].count, 10),
      },
    });
  })
);

/** CSV/JSON export of the filtered response set (no pagination limit applied server-side beyond a safety cap). Must be registered before "/:id". */
responsesRouter.get(
  "/export/:format",
  requireAuth,
  asyncHandler(async (req, res) => {
    const projectId = req.query.projectId as string | undefined;
    if (!projectId) throw ApiError.badRequest("projectId query parameter is required");
    req.params.projectId = projectId;
    await new Promise<void>((resolve, reject) => {
      requireProjectMembership()(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    const format = req.params.format;
    if (format !== "csv" && format !== "json") throw ApiError.badRequest("format must be csv or json");

    const result = await query(
      `SELECT id, widget_id, rating, nps_score, feedback_text, metadata, created_at
       FROM responses WHERE project_id = $1 ORDER BY created_at DESC LIMIT 10000`,
      [projectId]
    );

    if (format === "json") {
      res.setHeader("Content-Disposition", "attachment; filename=responses.json");
      return res.json({ responses: result.rows });
    }

    const header = "id,widget_id,rating,nps_score,feedback_text,page_url,created_at";
    const rows = result.rows.map((r) => {
      const metadata = r.metadata ?? {};
      const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      return [r.id, r.widget_id, r.rating ?? "", r.nps_score ?? "", escape(r.feedback_text), escape(metadata.pageUrl), r.created_at.toISOString()].join(",");
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=responses.csv");
    res.send([header, ...rows].join("\n"));
  })
);

responsesRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query(`SELECT * FROM responses WHERE id = $1`, [req.params.id]);
    if (result.rowCount === 0) throw ApiError.notFound("Response not found");

    req.params.projectId = result.rows[0].project_id;
    await new Promise<void>((resolve, reject) => {
      requireProjectMembership()(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    const answers = await query(`SELECT * FROM response_answers WHERE response_id = $1`, [req.params.id]);
    res.json({ response: { ...result.rows[0], answers: answers.rows } });
  })
);

export { NPS_CATEGORY };
