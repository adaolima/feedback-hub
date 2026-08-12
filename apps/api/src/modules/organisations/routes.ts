import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../../db";
import { asyncHandler, validateBody } from "../../lib/validate";
import { ApiError } from "../../lib/errors";
import { requireAuth } from "../../middleware/auth";
import { requireOrgMembership, requireOrgPermission } from "../../middleware/tenant";

export const organisationsRouter = Router();
organisationsRouter.use(requireAuth);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

organisationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT o.id, o.name, o.slug, o.created_at, m.role
       FROM organisations o
       JOIN organisation_members m ON m.organisation_id = o.id
       WHERE m.user_id = $1 AND o.deleted_at IS NULL
       ORDER BY o.created_at ASC`,
      [req.user!.id]
    );
    res.json({ organisations: result.rows });
  })
);

const createOrgSchema = z.object({ name: z.string().min(1).max(120) });

organisationsRouter.post(
  "/",
  validateBody(createOrgSchema),
  asyncHandler(async (req, res) => {
    const { name } = req.body;
    let slug = slugify(name);

    const org = await withTransaction(async (client) => {
      const existing = await client.query(`SELECT id FROM organisations WHERE slug = $1`, [slug]);
      if (existing.rowCount && existing.rowCount > 0) {
        slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
      }
      const orgResult = await client.query(
        `INSERT INTO organisations (name, slug) VALUES ($1, $2) RETURNING id, name, slug, created_at`,
        [name, slug]
      );
      await client.query(
        `INSERT INTO organisation_members (organisation_id, user_id, role) VALUES ($1, $2, 'OWNER')`,
        [orgResult.rows[0].id, req.user!.id]
      );
      return orgResult.rows[0];
    });

    res.status(201).json({ organisation: org });
  })
);

organisationsRouter.get(
  "/:id",
  requireOrgMembership(),
  asyncHandler(async (req, res) => {
    const result = await query(`SELECT id, name, slug, created_at FROM organisations WHERE id = $1 AND deleted_at IS NULL`, [
      req.params.id,
    ]);
    if (result.rowCount === 0) throw ApiError.notFound("Organisation not found");
    res.json({ organisation: result.rows[0] });
  })
);

organisationsRouter.get(
  "/:id/members",
  requireOrgPermission("user:manage"),
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT u.id, u.email, u.name, m.role, m.created_at
       FROM organisation_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.organisation_id = $1
       ORDER BY m.created_at ASC`,
      [req.params.id]
    );
    res.json({ members: result.rows });
  })
);

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
});

/** Simplified invite: adds an existing registered user directly to the organisation. */
organisationsRouter.post(
  "/:id/members",
  requireOrgPermission("user:manage"),
  validateBody(inviteSchema),
  asyncHandler(async (req, res) => {
    const { email, role } = req.body;
    const userResult = await query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase()]);
    if (userResult.rowCount === 0) {
      throw ApiError.notFound("No account exists for this email yet. Ask them to register first.");
    }

    const member = await query(
      `INSERT INTO organisation_members (organisation_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (organisation_id, user_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING organisation_id, user_id, role`,
      [req.params.id, userResult.rows[0].id, role]
    );
    res.status(201).json({ member: member.rows[0] });
  })
);

organisationsRouter.delete(
  "/:id/members/:userId",
  requireOrgPermission("user:manage"),
  asyncHandler(async (req, res) => {
    await query(`DELETE FROM organisation_members WHERE organisation_id = $1 AND user_id = $2`, [
      req.params.id,
      req.params.userId,
    ]);
    res.status(204).send();
  })
);
