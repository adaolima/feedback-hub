import { Router } from "express";
import { z } from "zod";
import { query } from "../../db";
import { asyncHandler, validateBody } from "../../lib/validate";
import { publicRateLimiter } from "../../middleware/rateLimit";
import { extractProjectKey, resolveProjectByPublicKey } from "../../lib/publicAuth";

export const publicRouter = Router();
publicRouter.use(publicRateLimiter);

/** Bootstrap payload for the SDK: published widgets + their config, keyed off the public project key. */
publicRouter.get(
  "/config",
  asyncHandler(async (req, res) => {
    const projectKey = extractProjectKey(req);
    const { projectId } = await resolveProjectByPublicKey(projectKey);

    const widgets = await query(
      `SELECT id, survey_id, name, type, config FROM widgets
       WHERE project_id = $1 AND status = 'published' AND deleted_at IS NULL`,
      [projectId]
    );

    const surveyIds = widgets.rows.filter((w) => w.survey_id).map((w) => w.survey_id);
    let surveysById: Record<string, any> = {};
    if (surveyIds.length) {
      const surveys = await query(`SELECT * FROM surveys WHERE id = ANY($1)`, [surveyIds]);
      const questions = await query(
        `SELECT * FROM survey_questions WHERE survey_id = ANY($1) ORDER BY position ASC`,
        [surveyIds]
      );
      const questionIds = questions.rows.map((q) => q.id);
      const options = questionIds.length
        ? await query(`SELECT * FROM survey_options WHERE question_id = ANY($1) ORDER BY position ASC`, [questionIds])
        : { rows: [] as any[] };

      surveysById = Object.fromEntries(
        surveys.rows.map((s) => [
          s.id,
          {
            ...s,
            questions: questions.rows
              .filter((q) => q.survey_id === s.id)
              .map((q) => ({ ...q, options: options.rows.filter((o) => o.question_id === q.id) })),
          },
        ])
      );
    }

    res.json({
      projectId,
      widgets: widgets.rows.map((w) => ({ ...w, survey: w.survey_id ? surveysById[w.survey_id] : undefined })),
    });
  })
);

const trackEventSchema = z.object({
  projectKey: z.string().min(1),
  name: z.string().min(1).max(160),
  anonymousId: z.string().max(120).optional(),
  userId: z.string().uuid().optional(),
  sessionId: z.string().max(120).optional(),
  properties: z.record(z.any()).default({}),
});

publicRouter.post(
  "/events",
  validateBody(trackEventSchema),
  asyncHandler(async (req, res) => {
    const projectKey = extractProjectKey(req) ?? req.body.projectKey;
    const { projectId } = await resolveProjectByPublicKey(projectKey);

    await query(
      `INSERT INTO events (project_id, anonymous_id, user_id, session_id, name, properties)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        projectId,
        req.body.anonymousId ?? null,
        req.body.userId ?? null,
        req.body.sessionId ?? null,
        req.body.name,
        JSON.stringify(req.body.properties),
      ]
    );

    res.status(201).json({ ok: true });
  })
);
