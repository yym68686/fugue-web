import "server-only";

import { createHash } from "node:crypto";

import type { SessionUser } from "@/lib/auth/session";
import { normalizeEmail, sanitizeDisplayName } from "@/lib/auth/validation";
import {
  createFugueApiKey,
  createFugueTenant,
  enableFugueApiKey,
  listFugueApiKeys,
  listFugueTenants,
  readAdminErrorStatus,
  type FugueApiKey,
  type FugueTenant,
} from "@/lib/fugue/platform-admin";
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

// Coalesce concurrent provisioning for the same user so a burst of requests
// (e.g. sign-in redirect + immediate deploy) shares one create.
const inflight = new Map<string, Promise<WorkspaceAccess>>();

type ProvisionOptions = {
  // When true, an existing usable workspace short-circuits before any backend
  // mutation. This is the sign-in path: existing users must never be touched.
  preferExisting?: boolean;
};

function slugSeed(value: string) {
  const seed = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  return seed || "workspace";
}

// Deterministic per-email suffix so we can recognise a user's own tenant later
// even if their display name changes.
function tenantSuffix(email: string) {
  return createHash("sha256")
    .update(normalizeEmail(email))
    .digest("hex")
    .slice(0, 6);
}

function buildTenantName(email: string, name?: string) {
  const preferred = sanitizeDisplayName(name ?? "") || email.split("@")[0] || "workspace";
  const base = slugSeed(preferred).replace(/-/g, " ");
  return sanitizeDisplayName(`${base} workspace ${tenantSuffix(email)}`);
}

// Match a tenant that this user's provisioning would have created. Prefer an
// exact name/slug hit, else fall back to the deterministic suffix.
function findOwnTenant(tenants: FugueTenant[], session: SessionUser) {
  const preferredName = buildTenantName(session.email, session.name);
  const preferredSlug = slugSeed(preferredName);
  const suffix = tenantSuffix(session.email);
  const nameSuffix = ` ${suffix}`;
  const slugSuffix = `-${suffix}`;

  const exact = tenants.find(
    (tenant) => tenant.name === preferredName || tenant.slug === preferredSlug,
  );
  if (exact) {
    return exact;
  }

  return (
    tenants.find(
      (tenant) =>
        tenant.name.endsWith(nameSuffix) || tenant.slug?.endsWith(slugSuffix),
    ) ?? null
  );
}

async function resolveTenant(session: SessionUser): Promise<FugueTenant> {
  const tenants = await listFugueTenants();
  const existing = findOwnTenant(tenants, session);
  if (existing) {
    return existing;
  }

  try {
    return await createFugueTenant(buildTenantName(session.email, session.name));
  } catch (error) {
    // A concurrent create can race us to a 409; re-resolve from the fresh list.
    if (readAdminErrorStatus(error) !== 409) {
      throw error;
    }
    const refreshed = await listFugueTenants();
    const conflicted = findOwnTenant(refreshed, session);
    if (!conflicted) {
      throw error;
    }
    return conflicted;
  }
}

// Reuse the user's stored admin key when it is still present and enabled on the
// backend; otherwise mint a fresh one. Never returns without a usable secret.
async function resolveAdminKey(
  tenantId: string,
  existing: WorkspaceBootstrapState | null,
): Promise<{ apiKey: FugueApiKey; secret: string }> {
  const scopes = sortFugueScopes(WORKSPACE_ADMIN_SCOPES);

  if (existing?.adminKeySecret && existing.adminKeyId) {
    const keys = await listFugueApiKeys();
    const stored = keys.find(
      (key) => key.id === existing.adminKeyId && key.tenantId === tenantId,
    );
    if (stored) {
      const apiKey =
        stored.status?.trim().toLowerCase() === "disabled"
          ? await enableFugueApiKey(stored.id)
          : stored;
      return { apiKey, secret: existing.adminKeySecret };
    }
  }

  const created = await createFugueApiKey({
    tenantId,
    label: WORKSPACE_ADMIN_KEY_LABEL,
    scopes,
  });
  return created;
}

async function provisionInternal(session: SessionUser): Promise<WorkspaceAccess> {
  await ensureAppUser(session);

  const existing = await getWorkspaceBootstrapStateByEmail(session.email);
  const tenant = await resolveTenant(session);
  const { apiKey, secret } = await resolveAdminKey(tenant.id, existing);
  const now = new Date().toISOString();

  await saveWorkspaceAccess({
    adminKeyId: apiKey.id,
    adminKeyLabel: apiKey.label || WORKSPACE_ADMIN_KEY_LABEL,
    adminKeyPrefix: apiKey.prefix || null,
    adminKeyScopes: sortFugueScopes(
      apiKey.scopes.length ? apiKey.scopes : WORKSPACE_ADMIN_SCOPES,
    ),
    adminKeySecret: secret,
    createdAt: existing?.createdAt ?? now,
    defaultProjectId: existing?.defaultProjectId ?? null,
    defaultProjectName: existing?.defaultProjectName ?? null,
    email: session.email,
    firstAppId: existing?.firstAppId ?? null,
    tenantId: tenant.id,
    tenantName: tenant.name,
    updatedAt: now,
  });

  const saved = await getWorkspaceAccessByEmail(session.email);
  if (!saved) {
    throw new Error("Workspace was provisioned but could not be reloaded.");
  }
  return saved;
}

async function provision(
  session: SessionUser,
  options?: ProvisionOptions,
): Promise<WorkspaceAccess> {
  const email = normalizeEmail(session.email);

  if (options?.preferExisting) {
    await ensureAppUser(session);
    const current = await getWorkspaceAccessByEmail(email);
    if (current?.adminKeySecret) {
      return current;
    }
  }

  const pending = inflight.get(email);
  if (pending) {
    return pending;
  }

  const request = provisionInternal(session).finally(() => {
    if (inflight.get(email) === request) {
      inflight.delete(email);
    }
  });
  inflight.set(email, request);
  return request;
}

/**
 * Ensure the signed-in user has a provisioned workspace (tenant + admin key).
 *
 * Called from the auth entry points. Existing users with a usable stored key
 * short-circuit before any backend mutation, so re-enabling this on sign-in
 * has zero effect on the 94 workspaces that already exist — only brand-new
 * users (no row) reach the create path.
 */
export async function ensureWorkspaceAccessForSignIn(session: SessionUser) {
  return provision(session, { preferExisting: true });
}

/** Force provisioning/repair regardless of stored state. */
export async function ensureWorkspaceAccess(session: SessionUser) {
  return provision(session);
}
