import { NextFunction, Request, Response } from "express";
import { OrgRole, roleHasPermission } from "@feedbackhub/shared";
import { query } from "../db";
import { ApiError } from "../lib/errors";

export interface Membership {
  organisationId: string;
  role: OrgRole;
}

export async function getMembership(userId: string, organisationId: string): Promise<Membership | null> {
  const result = await query<{ role: OrgRole }>(
    `SELECT role FROM organisation_members WHERE user_id = $1 AND organisation_id = $2`,
    [userId, organisationId]
  );
  if (result.rowCount === 0) return null;
  return { organisationId, role: result.rows[0].role };
}

/**
 * Resolves the organisation that owns a project, then verifies the current user is a member
 * with the required permission. Attaches `req.membership` and `req.projectId`.
 * This is the core tenant-isolation guard used by all project-scoped routes.
 */
export function requireProjectPermission(permission: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const projectId = req.params.projectId ?? req.params.id ?? (req.body?.projectId as string);
      if (!projectId) return next(ApiError.badRequest("Missing projectId"));

      const projectResult = await query<{ organisation_id: string }>(
        `SELECT organisation_id FROM projects WHERE id = $1 AND deleted_at IS NULL`,
        [projectId]
      );
      if (projectResult.rowCount === 0) return next(ApiError.notFound("Project not found"));

      const organisationId = projectResult.rows[0].organisation_id;
      const membership = await getMembership(req.user!.id, organisationId);
      if (!membership) return next(ApiError.forbidden("Not a member of this organisation"));
      if (!roleHasPermission(membership.role, permission)) {
        return next(ApiError.forbidden("Insufficient permissions"));
      }

      (req as any).membership = membership;
      (req as any).projectId = projectId;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Same as requireProjectPermission, but allows any member (used for read-only endpoints). */
export function requireProjectMembership() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const projectId = req.params.projectId ?? req.params.id ?? (req.body?.projectId as string);
      if (!projectId) return next(ApiError.badRequest("Missing projectId"));

      const projectResult = await query<{ organisation_id: string }>(
        `SELECT organisation_id FROM projects WHERE id = $1 AND deleted_at IS NULL`,
        [projectId]
      );
      if (projectResult.rowCount === 0) return next(ApiError.notFound("Project not found"));

      const organisationId = projectResult.rows[0].organisation_id;
      const membership = await getMembership(req.user!.id, organisationId);
      if (!membership) return next(ApiError.forbidden("Not a member of this organisation"));

      (req as any).membership = membership;
      (req as any).projectId = projectId;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireOrgPermission(permission: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const organisationId = req.params.organisationId ?? req.params.id;
      if (!organisationId) return next(ApiError.badRequest("Missing organisationId"));

      const membership = await getMembership(req.user!.id, organisationId);
      if (!membership) return next(ApiError.forbidden("Not a member of this organisation"));
      if (!roleHasPermission(membership.role, permission)) {
        return next(ApiError.forbidden("Insufficient permissions"));
      }
      (req as any).membership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Any role may pass; used for read-only endpoints where all members should have access. */
export function requireOrgMembership() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const organisationId = req.params.organisationId ?? req.params.id;
      if (!organisationId) return next(ApiError.badRequest("Missing organisationId"));

      const membership = await getMembership(req.user!.id, organisationId);
      if (!membership) return next(ApiError.forbidden("Not a member of this organisation"));
      (req as any).membership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
}
