import "server-only";

import { createHash } from "node:crypto";

import type { SessionUser } from "@/lib/auth/session";
import { sanitizeDisplayName } from "@/lib/auth/validation";
import {
  createFugueApiKey,
  createFugueTenant,
} from "@/lib/fugue/api";
import { getFugueEnv } from "@/lib/fugue/env";
import { WORKSPACE_ADMIN_SCOPES } from "@/lib/fugue/scopes";
import {
  ensureAppUser,
  getWorkspaceAccessByEmail,
  saveWorkspaceAccess,
  type WorkspaceAccess,
} from "@/lib/workspace/store";

function slugSeed(value: string) {
  const seed = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  return seed || "workspace";
}

function buildTenantName(email: string, name?: string) {
  const preferred =
    sanitizeDisplayName(name ?? "") ||
    email.split("@")[0] ||
    "workspace";
  const suffix = createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 6);
  const base = slugSeed(preferred).replace(/-/g, " ");

  return sanitizeDisplayName(`${base} workspace ${suffix}`);
}

export async function ensureWorkspaceAccess(session: SessionUser) {
  await ensureAppUser(session);

  const existing = await getWorkspaceAccessByEmail(session.email);

  if (existing) {
    return {
      created: false,
      workspace: existing,
    };
  }

  const env = getFugueEnv();
  const tenant = await createFugueTenant(env.bootstrapKey, {
    name: buildTenantName(session.email, session.name),
  });
  const createdAt = new Date().toISOString();
  const createdApiKey = await createFugueApiKey(env.bootstrapKey, {
    label: "workspace-admin",
    scopes: [...WORKSPACE_ADMIN_SCOPES],
    tenantId: tenant.id,
  });
  const nextWorkspace = {
    adminKeyId: createdApiKey.apiKey.id,
    adminKeyLabel: createdApiKey.apiKey.label,
    adminKeyPrefix: createdApiKey.apiKey.prefix,
    adminKeyScopes:
      createdApiKey.apiKey.scopes.length > 0
        ? createdApiKey.apiKey.scopes
        : [...WORKSPACE_ADMIN_SCOPES],
    adminKeySecret: createdApiKey.secret,
    createdAt,
    defaultProjectId: null,
    defaultProjectName: null,
    email: session.email,
    firstAppId: null,
    tenantId: tenant.id,
    tenantName: tenant.name,
    updatedAt: createdAt,
  } satisfies WorkspaceAccess;

  await saveWorkspaceAccess(nextWorkspace);
  const createdWorkspace = await getWorkspaceAccessByEmail(session.email);

  if (!createdWorkspace) {
    throw new Error("Workspace admin key was created but could not be reloaded.");
  }

  return {
    created: true,
    workspace: createdWorkspace,
  };
}
