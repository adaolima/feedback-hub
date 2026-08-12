import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { query } from "../../db";
import { hashToken } from "../../lib/tokens";
import { asyncHandler, validateBody } from "../../lib/validate";
import { ApiError } from "../../lib/errors";
import { requireAuth } from "../../middleware/auth";
import { requireProjectMembership, requireProjectPermission } from "../../middleware/tenant";

export const apiKeysRouter = Router();
apiKeysRouter.use(requireAuth);

function generatePublicKey(): string {
  return `pk_${crypto.randomBytes(18).toString("hex")}`;
}
function generateSecretKey(): string {
  return `sk_${crypto.randomBytes(24).toString("hex")}`;
}

apiKeysRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const projectId = req.query.projectId as string | undefined;
    if (!projectId) throw ApiError.badRequest("projectId query parameter is required");
    req.params.projectId = projectId;
    await new Promise<void>((resolve, reject) => {
      requireProjectMembership()(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    const result = await query(
      `SELECT id, project_id, name, type, key_value, last_four, revoked_at, created_at
       FROM api_keys WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId]
    );
    res.json({ apiKeys: result.rows });
  })
);

const createKeySchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(120),
  type: z.enum(["public", "secret"]),
});

apiKeysRouter.post(
  "/",
  validateBody(createKeySchema),
  asyncHandler(async (req, res) => {
    const { projectId, name, type } = req.body;
    req.params.projectId = projectId;
    await new Promise<void>((resolve, reject) => {
      requireProjectPermission("apikey:manage")(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    let plainKey: string;
    let keyValue: string | null = null;
    let keyHash: string | null = null;
    let lastFour: string | null = null;

    if (type === "public") {
      plainKey = generatePublicKey();
      keyValue = plainKey;
    } else {
      plainKey = generateSecretKey();
      keyHash = hashToken(plainKey);
      lastFour = plainKey.slice(-4);
    }

    const result = await query(
      `INSERT INTO api_keys (project_id, name, type, key_value, key_hash, last_four, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, project_id, name, type, key_value, last_four, revoked_at, created_at`,
      [projectId, name, type, keyValue, keyHash, lastFour, req.user!.id]
    );

    // The raw secret is only ever shown once, at creation time.
    res.status(201).json({ apiKey: { ...result.rows[0], secret: type === "secret" ? plainKey : undefined } });
  })
);

apiKeysRouter.post(
  "/:id/rotate",
  asyncHandler(async (req, res) => {
    const existing = await query(`SELECT project_id, type, name FROM api_keys WHERE id = $1`, [req.params.id]);
    if (existing.rowCount === 0) throw ApiError.notFound("API key not found");
    req.params.projectId = existing.rows[0].project_id;
    await new Promise<void>((resolve, reject) => {
      requireProjectPermission("apikey:manage")(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    await query(`UPDATE api_keys SET revoked_at = now() WHERE id = $1`, [req.params.id]);

    const { type, name, project_id } = existing.rows[0];
    let plainKey: string;
    let keyValue: string | null = null;
    let keyHash: string | null = null;
    let lastFour: string | null = null;
    if (type === "public") {
      plainKey = generatePublicKey();
      keyValue = plainKey;
    } else {
      plainKey = generateSecretKey();
      keyHash = hashToken(plainKey);
      lastFour = plainKey.slice(-4);
    }

    const created = await query(
      `INSERT INTO api_keys (project_id, name, type, key_value, key_hash, last_four, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, project_id, name, type, key_value, last_four, revoked_at, created_at`,
      [project_id, name, type, keyValue, keyHash, lastFour, req.user!.id]
    );

    res.json({ apiKey: { ...created.rows[0], secret: type === "secret" ? plainKey : undefined } });
  })
);

const renameKeySchema = z.object({ name: z.string().min(1).max(120) });

apiKeysRouter.patch(
  "/:id",
  validateBody(renameKeySchema),
  asyncHandler(async (req, res) => {
    const existing = await query(`SELECT project_id FROM api_keys WHERE id = $1`, [req.params.id]);
    if (existing.rowCount === 0) throw ApiError.notFound("API key not found");
    req.params.projectId = existing.rows[0].project_id;
    await new Promise<void>((resolve, reject) => {
      requireProjectPermission("apikey:manage")(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    const result = await query(
      `UPDATE api_keys SET name = $1 WHERE id = $2
       RETURNING id, project_id, name, type, key_value, last_four, revoked_at, created_at`,
      [req.body.name, req.params.id]
    );
    res.json({ apiKey: result.rows[0] });
  })
);

apiKeysRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await query(`SELECT project_id FROM api_keys WHERE id = $1`, [req.params.id]);
    if (existing.rowCount === 0) throw ApiError.notFound("API key not found");
    req.params.projectId = existing.rows[0].project_id;
    await new Promise<void>((resolve, reject) => {
      requireProjectPermission("apikey:manage")(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    await query(`UPDATE api_keys SET revoked_at = now() WHERE id = $1`, [req.params.id]);
    res.status(204).send();
  })
);
