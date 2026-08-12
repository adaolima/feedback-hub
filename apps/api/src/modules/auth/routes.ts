import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../../db";
import { hashPassword, verifyPassword } from "../../lib/password";
import {
  generateOpaqueToken,
  generateRefreshToken,
  hashToken,
  refreshTokenExpiry,
  signAccessToken,
} from "../../lib/tokens";
import { asyncHandler, validateBody } from "../../lib/validate";
import { ApiError } from "../../lib/errors";
import { env } from "../../config/env";
import { requireAuth } from "../../middleware/auth";

export const authRouter = Router();

const REFRESH_COOKIE = "fh_refresh_token";

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax" as const,
    maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    path: "/api/v1/auth",
  };
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120).optional(),
});

authRouter.post(
  "/register",
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;

    const existing = await query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase()]);
    if (existing.rowCount && existing.rowCount > 0) {
      throw ApiError.conflict("An account with this email already exists");
    }

    const passwordHash = await hashPassword(password);
    const user = await query<{ id: string; email: string; name: string | null }>(
      `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)
       RETURNING id, email, name`,
      [email.toLowerCase(), passwordHash, name ?? null]
    );

    const accessToken = await issueSession(req, res, user.rows[0].id, user.rows[0].email);
    res.status(201).json({ user: user.rows[0], accessToken });
  })
);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await query<{ id: string; email: string; name: string | null; password_hash: string }>(
      `SELECT id, email, name, password_hash FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase()]
    );
    if (result.rowCount === 0) throw ApiError.unauthorized("Invalid email or password");

    const user = result.rows[0];
    const valid = await verifyPassword(user.password_hash, password);
    if (!valid) throw ApiError.unauthorized("Invalid email or password");

    const accessToken = await issueSession(req, res, user.id, user.email);
    res.json({ user: { id: user.id, email: user.email, name: user.name }, accessToken });
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw ApiError.unauthorized("Missing refresh token");

    const tokenHash = hashToken(token);
    const sessionResult = await query<{ id: string; user_id: string; expires_at: string; revoked_at: string | null }>(
      `SELECT id, user_id, expires_at, revoked_at FROM sessions WHERE refresh_token_hash = $1`,
      [tokenHash]
    );

    if (sessionResult.rowCount === 0) throw ApiError.unauthorized("Invalid refresh token");
    const session = sessionResult.rows[0];

    if (session.revoked_at || new Date(session.expires_at) < new Date()) {
      throw ApiError.unauthorized("Refresh token expired or revoked");
    }

    // Rotate: revoke old session, issue a brand new refresh token.
    await query(`UPDATE sessions SET revoked_at = now() WHERE id = $1`, [session.id]);

    const userResult = await query<{ id: string; email: string }>(`SELECT id, email FROM users WHERE id = $1`, [
      session.user_id,
    ]);
    if (userResult.rowCount === 0) throw ApiError.unauthorized("User no longer exists");

    const accessToken = await issueSession(req, res, userResult.rows[0].id, userResult.rows[0].email);
    res.json({ ok: true, accessToken });
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      const tokenHash = hashToken(token);
      await query(`UPDATE sessions SET revoked_at = now() WHERE refresh_token_hash = $1`, [tokenHash]);
    }
    res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/auth" });
    res.json({ ok: true });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query<{ id: string; email: string; name: string | null }>(
      `SELECT id, email, name FROM users WHERE id = $1`,
      [req.user!.id]
    );
    if (result.rowCount === 0) throw ApiError.notFound("User not found");
    res.json({ user: result.rows[0] });
  })
);

const forgotPasswordSchema = z.object({ email: z.string().email() });

authRouter.post(
  "/password/forgot",
  validateBody(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase()]);

    // Always respond 200 to avoid leaking whether an email is registered.
    if (user.rowCount && user.rowCount > 0) {
      const token = generateOpaqueToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [user.rows[0].id, hashToken(token), expiresAt]
      );
      // In production this would be emailed via SMTP; logged here for local/dev use.
      console.log(`Password reset token for ${email}: ${token}`);
    }
    res.json({ ok: true });
  })
);

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

authRouter.post(
  "/password/reset",
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { token, password } = req.body;
    const tokenHash = hashToken(token);

    const result = await query<{ id: string; user_id: string; expires_at: string; used_at: string | null }>(
      `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = $1`,
      [tokenHash]
    );
    if (result.rowCount === 0) throw ApiError.badRequest("Invalid or expired reset token");
    const record = result.rows[0];
    if (record.used_at || new Date(record.expires_at) < new Date()) {
      throw ApiError.badRequest("Invalid or expired reset token");
    }

    const passwordHash = await hashPassword(password);
    await withTransaction(async (client) => {
      await client.query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [
        passwordHash,
        record.user_id,
      ]);
      await client.query(`UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`, [record.id]);
      // Revoke all sessions on password change.
      await client.query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [
        record.user_id,
      ]);
    });

    res.json({ ok: true });
  })
);

async function issueSession(req: any, res: any, userId: string, email: string): Promise<string> {
  const accessToken = signAccessToken({ sub: userId, email });
  const refreshToken = generateRefreshToken();

  await query(
    `INSERT INTO sessions (user_id, refresh_token_hash, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, hashToken(refreshToken), req.headers["user-agent"] ?? null, req.ip, refreshTokenExpiry()]
  );

  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  return accessToken;
}
