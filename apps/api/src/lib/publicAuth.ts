import { Request } from "express";
import { query } from "../db";
import { ApiError } from "./errors";

export interface PublicProjectContext {
  projectId: string;
  organisationId: string;
}

/**
 * Resolves the project owning a given public API key. Used by all unauthenticated
 * SDK-facing endpoints (widget config fetch, response submission, event tracking).
 * Never trust a projectId sent directly by the client — always resolve via the key.
 */
export async function resolveProjectByPublicKey(projectKey: string | undefined): Promise<PublicProjectContext> {
  if (!projectKey) throw ApiError.unauthorized("Missing project key");

  const result = await query<{ project_id: string; organisation_id: string }>(
    `SELECT k.project_id, p.organisation_id
     FROM api_keys k
     JOIN projects p ON p.id = k.project_id
     WHERE k.key_value = $1 AND k.type = 'public' AND k.revoked_at IS NULL AND p.deleted_at IS NULL`,
    [projectKey]
  );

  if (result.rowCount === 0) throw ApiError.unauthorized("Invalid or revoked project key");
  return { projectId: result.rows[0].project_id, organisationId: result.rows[0].organisation_id };
}

export function extractProjectKey(req: Request): string | undefined {
  return (req.header("X-Project-Key") || (req.body?.projectKey as string) || (req.query?.projectKey as string)) ?? undefined;
}
