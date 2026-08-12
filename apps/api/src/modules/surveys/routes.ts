import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../../db";
import { asyncHandler, validateBody } from "../../lib/validate";
import { ApiError } from "../../lib/errors";
import { requireAuth } from "../../middleware/auth";
import { requireProjectMembership, requireProjectPermission } from "../../middleware/tenant";

export const surveysRouter = Router();
surveysRouter.use(requireAuth);

const QUESTION_TYPES = ["rating", "nps", "thumbs", "emoji", "text", "choice", "multiple_choice"] as const;

const optionSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  position: z.number().int().default(0),
});

const questionSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(QUESTION_TYPES),
  title: z.string().min(1),
  description: z.string().optional(),
  required: z.boolean().default(false),
  position: z.number().int().default(0),
  config: z.record(z.any()).default({}),
  conditionalLogic: z.record(z.any()).default({}),
  options: z.array(optionSchema).default([]),
});

async function loadSurveyWithQuestions(surveyId: string) {
  const survey = await query(`SELECT * FROM surveys WHERE id = $1 AND deleted_at IS NULL`, [surveyId]);
  if (survey.rowCount === 0) return null;

  const questions = await query(
    `SELECT * FROM survey_questions WHERE survey_id = $1 ORDER BY position ASC`,
    [surveyId]
  );
  const questionIds = questions.rows.map((q) => q.id);
  const options = questionIds.length
    ? await query(`SELECT * FROM survey_options WHERE question_id = ANY($1) ORDER BY position ASC`, [questionIds])
    : { rows: [] as any[] };

  return {
    ...survey.rows[0],
    questions: questions.rows.map((q) => ({
      ...q,
      options: options.rows.filter((o) => o.question_id === q.id),
    })),
  };
}

surveysRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const projectId = req.query.projectId as string | undefined;
    if (!projectId) throw ApiError.badRequest("projectId query parameter is required");
    req.params.projectId = projectId;
    await new Promise<void>((resolve, reject) => {
      requireProjectMembership()(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    const result = await query(
      `SELECT id, project_id, name, description, status, created_at, updated_at
       FROM surveys WHERE project_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [projectId]
    );
    res.json({ surveys: result.rows });
  })
);

const createSurveySchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(160),
  description: z.string().optional(),
  questions: z.array(questionSchema).default([]),
});

surveysRouter.post(
  "/",
  validateBody(createSurveySchema),
  asyncHandler(async (req, res) => {
    const { projectId, name, description, questions } = req.body;
    req.params.projectId = projectId;
    await new Promise<void>((resolve, reject) => {
      requireProjectPermission("survey:manage")(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    const surveyId = await withTransaction(async (client) => {
      const survey = await client.query(
        `INSERT INTO surveys (project_id, name, description) VALUES ($1, $2, $3) RETURNING id`,
        [projectId, name, description ?? null]
      );
      const id = survey.rows[0].id;
      await insertQuestions(client, id, questions);
      return id;
    });

    res.status(201).json({ survey: await loadSurveyWithQuestions(surveyId) });
  })
);

async function insertQuestions(client: import("pg").PoolClient, surveyId: string, questions: z.infer<typeof questionSchema>[]) {
  for (const q of questions) {
    const inserted = await client.query(
      `INSERT INTO survey_questions (survey_id, type, title, description, required, position, config, conditional_logic)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [surveyId, q.type, q.title, q.description ?? null, q.required, q.position, JSON.stringify(q.config), JSON.stringify(q.conditionalLogic)]
    );
    const questionId = inserted.rows[0].id;
    for (const opt of q.options) {
      await client.query(
        `INSERT INTO survey_options (question_id, label, value, position) VALUES ($1, $2, $3, $4)`,
        [questionId, opt.label, opt.value, opt.position]
      );
    }
  }
}

surveysRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const survey = await query(`SELECT project_id FROM surveys WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
    if (survey.rowCount === 0) throw ApiError.notFound("Survey not found");
    req.params.projectId = survey.rows[0].project_id;
    await new Promise<void>((resolve, reject) => {
      requireProjectMembership()(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    res.json({ survey: await loadSurveyWithQuestions(req.params.id) });
  })
);

const updateSurveySchema = z.object({
  name: z.string().min(1).max(160).optional(),
  description: z.string().optional(),
  questions: z.array(questionSchema).optional(),
});

/** Replaces the survey's question set wholesale when `questions` is provided (simplest reliable model for a builder UI). */
surveysRouter.patch(
  "/:id",
  validateBody(updateSurveySchema),
  asyncHandler(async (req, res) => {
    const survey = await query(`SELECT project_id FROM surveys WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
    if (survey.rowCount === 0) throw ApiError.notFound("Survey not found");
    req.params.projectId = survey.rows[0].project_id;
    await new Promise<void>((resolve, reject) => {
      requireProjectPermission("survey:manage")(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    const { name, description, questions } = req.body;
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE surveys SET name = COALESCE($1, name), description = COALESCE($2, description), updated_at = now() WHERE id = $3`,
        [name ?? null, description ?? null, req.params.id]
      );
      if (questions) {
        await client.query(`DELETE FROM survey_questions WHERE survey_id = $1`, [req.params.id]);
        await insertQuestions(client, req.params.id, questions);
      }
    });

    res.json({ survey: await loadSurveyWithQuestions(req.params.id) });
  })
);

surveysRouter.post(
  "/:id/publish",
  asyncHandler(async (req, res) => {
    const survey = await query(`SELECT project_id FROM surveys WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
    if (survey.rowCount === 0) throw ApiError.notFound("Survey not found");
    req.params.projectId = survey.rows[0].project_id;
    await new Promise<void>((resolve, reject) => {
      requireProjectPermission("survey:manage")(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    await query(`UPDATE surveys SET status = 'published', updated_at = now() WHERE id = $1`, [req.params.id]);
    res.json({ survey: await loadSurveyWithQuestions(req.params.id) });
  })
);

surveysRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const survey = await query(`SELECT project_id FROM surveys WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
    if (survey.rowCount === 0) throw ApiError.notFound("Survey not found");
    req.params.projectId = survey.rows[0].project_id;
    await new Promise<void>((resolve, reject) => {
      requireProjectPermission("survey:manage")(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    await query(`UPDATE surveys SET deleted_at = now() WHERE id = $1`, [req.params.id]);
    res.status(204).send();
  })
);
