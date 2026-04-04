import "server-only";

import { createHash } from "node:crypto";

import type { SessionUser } from "@/lib/auth/session";
import { normalizeEmail, sanitizeDisplayName } from "@/lib/auth/validation";
import {
  enableFugueApiKey,
  getFugueApps,
  getFugueApiKeys,
  getFugueProjects,
  getFugueTenants,
  type FugueApiKey,
  type FugueApp,
  type FugueProject,
  type FugueTenant,
  createFugueApiKey,
  createFugueTenant,
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
const workspaceAccessRequests = new Map<
  string,
  Promise<{
    created: boolean;
    workspace: WorkspaceAccess;
  }>
>();

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

function compareByTimestampAsc<
  T extends {
    createdAt?: string | null;
    updatedAt?: string | null;
  },
>(left: T, right: T) {
  return (
    parseTimestamp(left.createdAt ?? left.updatedAt) -
    parseTimestamp(right.createdAt ?? right.updatedAt)
  );
}

function resolveWorkspaceDefaultProject(
  projects: FugueProject[],
  defaultProjectId: string | null,
) {
  if (!projects.length) {
    return null;
  }

  if (defaultProjectId) {
    return projects.find((project) => project.id === defaultProjectId) ?? null;
  }

  return [...projects].sort(compareByTimestampAsc)[0] ?? null;
}

function resolveWorkspaceFirstApp(
  apps: FugueApp[],
  tenantId: string,
) {
  const tenantApps = apps.filter((app) => app.tenantId === tenantId);
  const appsWithoutTenant = apps.filter((app) => !app.tenantId);
  const candidates = tenantApps.length > 0 ? tenantApps : appsWithoutTenant;

  return [...candidates].sort(compareByTimestampAsc)[0] ?? null;
}

async function backfillWorkspaceResourcePointers(workspace: WorkspaceAccess) {
  const needsProjectBackfill =
    !workspace.defaultProjectId || !workspace.defaultProjectName;
  const needsAppBackfill = !workspace.firstAppId;

  if (!needsProjectBackfill && !needsAppBackfill) {
    return workspace;
  }

  try {
    const [projects, apps] = await Promise.all([
      needsProjectBackfill
        ? getFugueProjects(workspace.adminKeySecret, workspace.tenantId)
        : Promise.resolve([] as FugueProject[]),
      needsAppBackfill
        ? getFugueApps(workspace.adminKeySecret, {
            includeLiveStatus: false,
            includeResourceUsage: false,
          })
        : Promise.resolve([] as FugueApp[]),
    ]);
    const defaultProject = needsProjectBackfill
      ? resolveWorkspaceDefaultProject(projects, workspace.defaultProjectId)
      : null;
    const firstApp = needsAppBackfill
      ? resolveWorkspaceFirstApp(apps, workspace.tenantId)
      : null;

    if (!defaultProject && !firstApp) {
      return workspace;
    }

    return {
      ...workspace,
      ...(defaultProject
        ? {
            defaultProjectId: defaultProject.id,
            defaultProjectName: defaultProject.name,
          }
        : {}),
      ...(firstApp
        ? {
            firstAppId: firstApp.id,
          }
        : {}),
    } satisfies WorkspaceAccess;
  } catch (error) {
    console.warn("Workspace resource pointer backfill failed.", {
      email: workspace.email,
      tenantId: workspace.tenantId,
      reason: error instanceof Error ? error.message : String(error),
    });

    return workspace;
  }
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

function listTenantApiKeys(keys: FugueApiKey[], tenantId: string) {
  return keys.filter((key) => key.tenantId === tenantId);
}

function sameStringArray(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function readWorkspaceAdminScopes(
  workspace?: WorkspaceBootstrapState | null,
  apiKey?: Pick<FugueApiKey, "scopes"> | null,
) {
  const remoteScopes = sortFugueScopes(apiKey?.scopes ?? []);
  const localScopes = sortFugueScopes(workspace?.adminKeyScopes ?? []);

  return sortFugueScopes([
    ...WORKSPACE_ADMIN_SCOPES,
    ...(remoteScopes.length > 0
      ? remoteScopes
      : localScopes.length > 0
        ? localScopes
        : []),
  ]);
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

async function createWorkspaceAdminKey(
  bootstrapKey: string,
  tenantId: string,
  workspace?: WorkspaceBootstrapState | null,
) {
  const created = await createFugueApiKey(bootstrapKey, {
    label: WORKSPACE_ADMIN_KEY_LABEL,
    scopes: readWorkspaceAdminScopes(workspace, null),
    tenantId,
  });

  return {
    apiKey: created.apiKey,
    secret: created.secret,
  };
}

async function reconcileWorkspaceAdminKey(
  bootstrapKey: string,
  tenantId: string,
  workspace?: WorkspaceBootstrapState | null,
) {
  const visibleKeys = await getFugueApiKeys(bootstrapKey);
  const tenantKeys = listTenantApiKeys(visibleKeys, tenantId);
  const storedKey =
    workspace &&
    tenantKeys.find(
      (key) => key.id === workspace.adminKeyId,
    );

  if (!workspace || !storedKey) {
    return createWorkspaceAdminKey(bootstrapKey, tenantId, workspace);
  }

  let apiKey = storedKey;

  if (apiKey.status?.trim().toLowerCase() === "disabled") {
    apiKey = await enableFugueApiKey(bootstrapKey, apiKey.id);
  }

  const nextScopes = readWorkspaceAdminScopes(workspace, apiKey);
  const currentScopes = sortFugueScopes(apiKey.scopes);
  const needsScopeRepair = !sameStringArray(currentScopes, nextScopes);
  const needsMetadataRepair =
    apiKey.label.trim().toLowerCase() !== WORKSPACE_ADMIN_KEY_LABEL ||
    needsScopeRepair;

  if (needsMetadataRepair) {
    apiKey = await updateFugueApiKey(bootstrapKey, apiKey.id, {
      ...(apiKey.label.trim().toLowerCase() !== WORKSPACE_ADMIN_KEY_LABEL
        ? {
            label: WORKSPACE_ADMIN_KEY_LABEL,
          }
        : {}),
      ...(needsScopeRepair
        ? {
            scopes: nextScopes,
          }
        : {}),
    });
  }

  if (!(await hasUsableStoredAdminSecret(workspace, apiKey.id))) {
    console.warn("Stored workspace admin key secret is no longer usable. Minting a fresh workspace admin key for this environment.", {
      email: workspace.email,
      previousAdminKeyId: apiKey.id,
      tenantId,
    });

    return createWorkspaceAdminKey(bootstrapKey, tenantId, workspace);
  }

  return {
    apiKey,
    secret: workspace.adminKeySecret,
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

async function ensureWorkspaceAccessInternal(session: SessionUser) {
  await ensureAppUser(session);

  const existing = await getWorkspaceBootstrapStateByEmail(session.email);

  if (existing && !existing.adminKeySecret) {
    console.warn("Workspace admin key secret could not be decrypted. Minting a fresh workspace admin key for this environment.", {
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

  const nextWorkspace = await backfillWorkspaceResourcePointers({
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
  } satisfies WorkspaceAccess);

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

export async function ensureWorkspaceAccess(session: SessionUser) {
  const normalizedEmail = normalizeEmail(session.email);
  const pendingRequest = workspaceAccessRequests.get(normalizedEmail);

  if (pendingRequest) {
    return pendingRequest;
  }

  const request = ensureWorkspaceAccessInternal(session).finally(() => {
    if (workspaceAccessRequests.get(normalizedEmail) === request) {
      workspaceAccessRequests.delete(normalizedEmail);
    }
  });

  workspaceAccessRequests.set(normalizedEmail, request);
  return request;
}
