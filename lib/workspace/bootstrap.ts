import "server-only";

import { createHash } from "node:crypto";

import type { SessionUser } from "@/lib/auth/session";
import { sanitizeDisplayName } from "@/lib/auth/validation";
import {
  enableFugueApiKey,
  deleteFugueApiKey,
  getFugueApiKeys,
  getFugueTenants,
  type FugueApiKey,
  type FugueTenant,
  createFugueApiKey,
  createFugueTenant,
  rotateFugueApiKey,
  updateFugueApiKey,
} from "@/lib/fugue/api";
import { getFugueEnv } from "@/lib/fugue/env";
import { sortFugueScopes, WORKSPACE_ADMIN_SCOPES } from "@/lib/fugue/scopes";
import {
  ensureAppUser,
  getWorkspaceAccessByEmail,
  getWorkspaceBootstrapStateByEmail,
  saveWorkspaceAccess,
  type WorkspaceAccess,
  type WorkspaceBootstrapState,
} from "@/lib/workspace/store";

const WORKSPACE_ADMIN_KEY_LABEL = "workspace-admin";

function slugSeed(value: string) {
  const seed = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  return seed || "workspace";
}

function buildTenantSuffix(email: string) {
  return createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 6);
}

function buildTenantName(email: string, name?: string) {
  const preferred =
    sanitizeDisplayName(name ?? "") ||
    email.split("@")[0] ||
    "workspace";
  const suffix = buildTenantSuffix(email);
  const base = slugSeed(preferred).replace(/-/g, " ");

  return sanitizeDisplayName(`${base} workspace ${suffix}`);
}

function parseTimestamp(value?: string | null) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function findWorkspaceTenantForSession(
  tenants: FugueTenant[],
  session: SessionUser,
) {
  const preferredName = buildTenantName(session.email, session.name);
  const preferredSlug = slugSeed(preferredName);
  const suffix = buildTenantSuffix(session.email);
  const suffixOnName = ` ${suffix}`;
  const suffixOnSlug = `-${suffix}`;

  const exact = tenants.find(
    (tenant) => tenant.name === preferredName || tenant.slug === preferredSlug,
  );

  if (exact) {
    return exact;
  }

  return [...tenants]
    .filter(
      (tenant) =>
        tenant.name.endsWith(suffixOnName) ||
        tenant.slug?.endsWith(suffixOnSlug),
    )
    .sort(
      (left, right) =>
        parseTimestamp(left.createdAt ?? left.updatedAt) -
        parseTimestamp(right.createdAt ?? right.updatedAt),
    )[0] ?? null;
}

function pickWorkspaceAdminKey(
  keys: FugueApiKey[],
  tenantId: string,
) {
  return [...keys]
    .filter(
      (key) =>
        key.tenantId === tenantId &&
        key.label.trim().toLowerCase() === WORKSPACE_ADMIN_KEY_LABEL,
    )
    .sort((left, right) => {
      const leftActive = left.status?.trim().toLowerCase() !== "disabled";
      const rightActive = right.status?.trim().toLowerCase() !== "disabled";

      if (leftActive !== rightActive) {
        return leftActive ? -1 : 1;
      }

      return parseTimestamp(right.createdAt) - parseTimestamp(left.createdAt);
    })[0] ?? null;
}

function listTenantApiKeys(keys: FugueApiKey[], tenantId: string) {
  return keys.filter((key) => key.tenantId === tenantId);
}

function readWorkspaceAdminScopes(
  workspace?: WorkspaceBootstrapState | null,
  apiKey?: Pick<FugueApiKey, "scopes"> | null,
) {
  const remoteScopes = sortFugueScopes(apiKey?.scopes ?? []);

  if (remoteScopes.length) {
    return remoteScopes;
  }

  const localScopes = sortFugueScopes(workspace?.adminKeyScopes ?? []);

  if (localScopes.length) {
    return localScopes;
  }

  return sortFugueScopes([...WORKSPACE_ADMIN_SCOPES]);
}

async function hasUsableStoredAdminSecret(
  workspace: WorkspaceBootstrapState,
  adminKeyId: string,
) {
  if (!workspace.adminKeySecret) {
    return false;
  }

  try {
    const visibleKeys = await getFugueApiKeys(workspace.adminKeySecret);

    return visibleKeys.some(
      (key) => key.id === adminKeyId && key.tenantId === workspace.tenantId,
    );
  } catch {
    return false;
  }
}

async function deleteExtraTenantApiKeys(
  bootstrapKey: string,
  keys: FugueApiKey[],
  canonicalKeyId: string,
) {
  for (const key of keys) {
    if (key.id === canonicalKeyId) {
      continue;
    }

    await deleteFugueApiKey(bootstrapKey, key.id);
  }
}

async function reconcileWorkspaceAdminKey(
  bootstrapKey: string,
  tenantId: string,
  workspace?: WorkspaceBootstrapState | null,
) {
  const visibleKeys = await getFugueApiKeys(bootstrapKey);
  const tenantKeys = listTenantApiKeys(visibleKeys, tenantId);
  const storedCanonical =
    workspace &&
    tenantKeys.find(
      (key) =>
        key.id === workspace.adminKeyId &&
        key.label.trim().toLowerCase() === WORKSPACE_ADMIN_KEY_LABEL,
    );
  let canonical =
    storedCanonical ??
    pickWorkspaceAdminKey(tenantKeys, tenantId);
  let secret = workspace?.adminKeySecret ?? null;

  if (!canonical) {
    const created = await createFugueApiKey(bootstrapKey, {
      label: WORKSPACE_ADMIN_KEY_LABEL,
      scopes: readWorkspaceAdminScopes(workspace, null),
      tenantId,
    });

    canonical = created.apiKey;
    secret = created.secret;
  } else {
    if (canonical.status?.trim().toLowerCase() === "disabled") {
      canonical = await enableFugueApiKey(bootstrapKey, canonical.id);
    }

    const nextScopes = readWorkspaceAdminScopes(workspace, canonical);
    const needsMetadataRepair =
      canonical.label.trim().toLowerCase() !== WORKSPACE_ADMIN_KEY_LABEL ||
      canonical.scopes.length === 0;

    if (needsMetadataRepair) {
      canonical = await updateFugueApiKey(bootstrapKey, canonical.id, {
        ...(canonical.label.trim().toLowerCase() !== WORKSPACE_ADMIN_KEY_LABEL
          ? {
              label: WORKSPACE_ADMIN_KEY_LABEL,
            }
          : {}),
        ...(canonical.scopes.length === 0
          ? {
              scopes: nextScopes,
            }
          : {}),
      });
    }

    const needsSecretRefresh =
      !workspace ||
      workspace.adminKeyId !== canonical.id ||
      !(await hasUsableStoredAdminSecret(workspace, canonical.id));

    if (needsSecretRefresh) {
      const rotated = await rotateFugueApiKey(bootstrapKey, canonical.id, {
        label: WORKSPACE_ADMIN_KEY_LABEL,
        scopes: nextScopes,
      });

      canonical = rotated.apiKey;
      secret = rotated.secret;
    }
  }

  await deleteExtraTenantApiKeys(bootstrapKey, tenantKeys, canonical.id);

  return {
    apiKey: canonical,
    secret,
  };
}

async function resolveWorkspaceTenant(
  bootstrapKey: string,
  session: SessionUser,
) {
  const visibleTenants = await getFugueTenants(bootstrapKey);
  const existing = findWorkspaceTenantForSession(visibleTenants, session);

  if (existing) {
    return existing;
  }

  const requestedName = buildTenantName(session.email, session.name);

  try {
    return await createFugueTenant(bootstrapKey, {
      name: requestedName,
    });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("409")) {
      throw error;
    }

    const refreshedTenants = await getFugueTenants(bootstrapKey);
    const conflicted = findWorkspaceTenantForSession(refreshedTenants, session);

    if (!conflicted) {
      throw error;
    }

    return conflicted;
  }
}

export async function ensureWorkspaceAccess(session: SessionUser) {
  await ensureAppUser(session);

  const existing = await getWorkspaceBootstrapStateByEmail(session.email);

  if (existing && !existing.adminKeySecret) {
    console.warn("Workspace admin key secret could not be decrypted. Rotating stored workspace secret.", {
      email: session.email,
      tenantId: existing.tenantId,
    });
  }

  const env = getFugueEnv();
  const tenant = await resolveWorkspaceTenant(env.bootstrapKey, session);
  const createdAt = existing?.createdAt ?? new Date().toISOString();
  const created = !existing;
  const reconciled = await reconcileWorkspaceAdminKey(
    env.bootstrapKey,
    tenant.id,
    existing,
  );

  if (!reconciled.secret) {
    throw new Error("Workspace admin key secret could not be recovered.");
  }

  const nextWorkspace = {
    adminKeyId: reconciled.apiKey.id,
    adminKeyLabel: reconciled.apiKey.label,
    adminKeyPrefix: reconciled.apiKey.prefix,
    adminKeyScopes: readWorkspaceAdminScopes(existing, reconciled.apiKey),
    adminKeySecret: reconciled.secret,
    createdAt,
    defaultProjectId: existing?.defaultProjectId ?? null,
    defaultProjectName: existing?.defaultProjectName ?? null,
    email: session.email,
    firstAppId: existing?.firstAppId ?? null,
    tenantId: tenant.id,
    tenantName: tenant.name,
    updatedAt: new Date().toISOString(),
  } satisfies WorkspaceAccess;

  await saveWorkspaceAccess(nextWorkspace);
  const createdWorkspace = await getWorkspaceAccessByEmail(session.email);

  if (!createdWorkspace) {
    throw new Error("Workspace admin key was created but could not be reloaded.");
  }

  return {
    created,
    workspace: createdWorkspace,
  };
}
