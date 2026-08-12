import { Router } from "express";
import { NPS_CATEGORY } from "@feedbackhub/shared";
import { query } from "../../db";
import { asyncHandler } from "../../lib/validate";
import { ApiError } from "../../lib/errors";
import { requireAuth } from "../../middleware/auth";
import { requireProjectMembership } from "../../middleware/tenant";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

function dateRangeFilter(req: any, params: any[]): string {
  let clause = "";
  if (req.query.from) {
    params.push(req.query.from);
    clause += ` AND created_at >= $${params.length}`;
  }
  if (req.query.to) {
    params.push(req.query.to);
    clause += ` AND created_at <= $${params.length}`;
  }
  return clause;
}

analyticsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const projectId = req.query.projectId as string | undefined;
    if (!projectId) throw ApiError.badRequest("projectId query parameter is required");
    req.params.projectId = projectId;
    await new Promise<void>((resolve, reject) => {
      requireProjectMembership()(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    const params: any[] = [projectId];
    const dateClause = dateRangeFilter(req, params);
    const widgetClause = req.query.widgetId
      ? (() => {
          params.push(req.query.widgetId);
          return ` AND widget_id = $${params.length}`;
        })()
      : "";

    const where = `project_id = $1${dateClause}${widgetClause}`;

    const totals = await query(
      `SELECT
         COUNT(*) AS total_responses,
         AVG(rating) FILTER (WHERE rating IS NOT NULL) AS avg_rating,
         COUNT(*) FILTER (WHERE rating >= 4) AS positive,
         COUNT(*) FILTER (WHERE rating IS NOT NULL AND rating < 4) AS negative,
         COUNT(*) FILTER (WHERE created_at >= now() - interval '1 day') AS today,
         COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days') AS this_week,
         COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days') AS this_month
       FROM responses WHERE ${where}`,
      params
    );

    const npsScores = await query<{ nps_score: number }>(
      `SELECT nps_score FROM responses WHERE ${where} AND nps_score IS NOT NULL`,
      params
    );
    const scores = npsScores.rows.map((r) => r.nps_score);
    const nps = NPS_CATEGORY.calculate(scores);
    const promoters = scores.filter((s) => s >= 9).length;
    const passives = scores.filter((s) => s >= 7 && s <= 8).length;
    const detractors = scores.filter((s) => s <= 6).length;

    const thumbs = await query(
      `SELECT
         COUNT(*) FILTER (WHERE rating = 1) AS up,
         COUNT(*) FILTER (WHERE rating = 0) AS down
       FROM responses
       WHERE ${where} AND widget_id IN (SELECT id FROM widgets WHERE type = 'thumbs')`,
      params
    );

    const responsesOverTime = await query(
      `SELECT date_trunc('day', created_at) AS day, COUNT(*) AS count
       FROM responses WHERE ${where}
       GROUP BY day ORDER BY day ASC`,
      params
    );

    const ratingDistribution = await query(
      `SELECT rating, COUNT(*) AS count FROM responses
       WHERE ${where} AND rating IS NOT NULL GROUP BY rating ORDER BY rating ASC`,
      params
    );

    res.json({
      summary: {
        totalResponses: parseInt(totals.rows[0].total_responses, 10),
        averageRating: totals.rows[0].avg_rating ? parseFloat(totals.rows[0].avg_rating) : null,
        positiveFeedback: parseInt(totals.rows[0].positive, 10),
        negativeFeedback: parseInt(totals.rows[0].negative, 10),
        responsesToday: parseInt(totals.rows[0].today, 10),
        responsesThisWeek: parseInt(totals.rows[0].this_week, 10),
        responsesThisMonth: parseInt(totals.rows[0].this_month, 10),
      },
      nps: {
        score: nps,
        responses: scores.length,
        promoters,
        passives,
        detractors,
        promoterPct: scores.length ? Math.round((promoters / scores.length) * 100) : 0,
        passivePct: scores.length ? Math.round((passives / scores.length) * 100) : 0,
        detractorPct: scores.length ? Math.round((detractors / scores.length) * 100) : 0,
      },
      thumbs: {
        up: parseInt(thumbs.rows[0]?.up ?? "0", 10),
        down: parseInt(thumbs.rows[0]?.down ?? "0", 10),
      },
      charts: {
        responsesOverTime: responsesOverTime.rows,
        ratingDistribution: ratingDistribution.rows,
      },
    });
  })
);
