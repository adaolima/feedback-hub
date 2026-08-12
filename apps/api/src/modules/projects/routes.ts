import { Router } from "express";
import { z } from "zod";
import { query } from "../../db";
import { asyncHandler, validateBody } from "../../lib/validate";
import { ApiError } from "../../lib/errors";
import { requireAuth } from "../../middleware/auth";
import { requireOrgPermission, requireProjectMembership, requireProjectPermission } from "../../middleware/tenant";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Lists projects across every organisation the current user belongs to, optionally filtered. */
projectsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const organisationId = req.query.organisationId as string | undefined;
    const params: any[] = [req.user!.id];
    let sql = `
      SELECT p.id, p.organisation_id, p.name, p.slug, p.created_at, p.updated_at
      FROM projects p
      JOIN organisation_members m ON m.organisation_id = p.organisation_id
      WHERE m.user_id = $1 AND p.deleted_at IS NULL
    `;
    if (organisationId) {
      params.push(organisationId);
      sql += ` AND p.organisation_id = $${params.length}`;
    }
    sql += ` ORDER BY p.created_at DESC`;
    const result = await query(sql, params);
    res.json({ projects: result.rows });
  })
);

const createProjectSchema = z.object({
  organisationId: z.string().uuid(),
  name: z.string().min(1).max(120),
});

projectsRouter.post(
  "/",
  validateBody(createProjectSchema),
  asyncHandler(async (req, res) => {
    const { organisationId, name } = req.body;
    // Reuse org permission guard manually since body carries the org id, not a route param.
    req.params.organisationId = organisationId;
    await new Promise<void>((resolve, reject) => {
      requireOrgPermission("project:manage")(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    const slug = slugify(name);
    const result = await query(
      `INSERT INTO projects (organisation_id, name, slug) VALUES ($1, $2, $3)
       RETURNING id, organisation_id, name, slug, settings, created_at, updated_at`,
      [organisationId, name, slug]
    );
    res.status(201).json({ project: result.rows[0] });
  })
);

projectsRouter.get(
  "/:id",
  requireProjectMembership(),
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT id, organisation_id, name, slug, settings, created_at, updated_at
       FROM projects WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (result.rowCount === 0) throw ApiError.notFound("Project not found");
    res.json({ project: result.rows[0] });
  })
);

const updateProjectSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  settings: z.record(z.any()).optional(),
});

projectsRouter.patch(
  "/:id",
  requireProjectPermission("project:manage"),
  validateBody(updateProjectSchema),
  asyncHandler(async (req, res) => {
    const { name, settings } = req.body;
    const result = await query(
      `UPDATE projects SET
         name = COALESCE($1, name),
         settings = COALESCE($2, settings),
         updated_at = now()
       WHERE id = $3 AND deleted_at IS NULL
       RETURNING id, organisation_id, name, slug, settings, created_at, updated_at`,
      [name ?? null, settings ? JSON.stringify(settings) : null, req.params.id]
    );
    if (result.rowCount === 0) throw ApiError.notFound("Project not found");
    res.json({ project: result.rows[0] });
  })
);

projectsRouter.delete(
  "/:id",
  requireProjectPermission("project:manage"),
  asyncHandler(async (req, res) => {
    await query(`UPDATE projects SET deleted_at = now() WHERE id = $1`, [req.params.id]);
    res.status(204).send();
  })
);
