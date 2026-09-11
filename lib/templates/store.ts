import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { ensureDbSchema, withDbSchemaRetry } from "@/lib/db/schema";
import { queryDb } from "@/lib/db/pool";

export type TemplateApp = {
  name: string;
  description: string;
  source: { type: "github" | "image"; repoUrl?: string; branch?: string; imageRef?: string; buildStrategy?: string; dockerfilePath?: string; buildContextDir?: string; sourceDir?: string };
  runtimeId?: string; servicePort?: number; startupCommand?: string; networkMode?: string; envKeys: string[];
};
export type ProjectTemplate = { id: string; token: string; name: string; description: string; ownerEmail: string; apps: TemplateApp[]; createdAt: string; useCount: number };
type TemplateRow = { id: string; name: string; description: string; owner_email: string; snapshot: { apps?: TemplateApp[] }; created_at: Date | string; use_count: number };
function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
function toTemplate(row: TemplateRow, token = ""): ProjectTemplate { return { id: row.id, token, name: row.name, description: row.description, ownerEmail: row.owner_email, apps: Array.isArray(row.snapshot?.apps) ? row.snapshot.apps : [], createdAt: new Date(row.created_at).toISOString(), useCount: row.use_count ?? 0 }; }
export async function createProjectTemplate(input: { ownerEmail: string; name: string; description: string; apps: TemplateApp[] }) {
  await ensureDbSchema(); const token = randomBytes(24).toString("base64url"); const id = randomUUID();
  const result = await queryDb<TemplateRow>(`INSERT INTO app_project_templates (id, token_hash, name, description, owner_email, snapshot) VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id, name, description, owner_email, snapshot, created_at, use_count`, [id, hashToken(token), input.name, input.description, input.ownerEmail, JSON.stringify({ apps: input.apps })]);
  return toTemplate(result.rows[0], token);
}
export async function getProjectTemplate(token: string, opts: { incrementUse?: boolean } = {}) {
  const clean = token.trim(); if (!/^[A-Za-z0-9_-]{32,128}$/.test(clean)) return null;
  return withDbSchemaRetry(async () => { const result = await queryDb<TemplateRow>(`SELECT id, name, description, owner_email, snapshot, created_at, use_count FROM app_project_templates WHERE token_hash = $1 AND active = TRUE LIMIT 1`, [hashToken(clean)]); const row = result.rows[0]; if (!row) return null; if (opts.incrementUse) await queryDb(`UPDATE app_project_templates SET use_count = use_count + 1, updated_at = NOW() WHERE id = $1`, [row.id]); return toTemplate(row, clean); });
}

export async function incrementProjectTemplateUse(id: string) {
  await withDbSchemaRetry(() => queryDb(`UPDATE app_project_templates SET use_count = use_count + 1, updated_at = NOW() WHERE id = $1 AND active = TRUE`, [id]));
}

export async function revokeProjectTemplate(token: string, ownerEmail: string) {
  const template = await getProjectTemplate(token);
  if (!template || template.ownerEmail !== ownerEmail) return false;
  await withDbSchemaRetry(() => queryDb(`UPDATE app_project_templates SET active = FALSE, updated_at = NOW() WHERE id = $1 AND owner_email = $2`, [template.id, ownerEmail]));
  return true;
}
