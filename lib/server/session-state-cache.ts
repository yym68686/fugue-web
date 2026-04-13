import "server-only";

import type { AppUserRecord } from "@/lib/app-users/store";
import { getAppUserByEmail } from "@/lib/app-users/store";
import { normalizeEmail } from "@/lib/auth/validation";
import { createExpiringAsyncCache } from "@/lib/server/expiring-async-cache";
import type { WorkspaceAccess, WorkspaceSnapshot } from "@/lib/workspace/store";
import { getWorkspaceAccessByEmail } from "@/lib/workspace/store";

const SESSION_STATE_CACHE_TTL_MS = 60_000;

const appUserCache =
  createExpiringAsyncCache<AppUserRecord | null>(SESSION_STATE_CACHE_TTL_MS);
const workspaceAccessCache =
  createExpiringAsyncCache<WorkspaceAccess | null>(SESSION_STATE_CACHE_TTL_MS);

function workspaceSnapshotFromAccess(
  access: WorkspaceAccess,
): WorkspaceSnapshot {
  const { adminKeySecret: _adminKeySecret, ...snapshot } = access;
  return snapshot;
}

export async function getCachedAppUserByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  return appUserCache.getOrLoad(normalizedEmail, () =>
    getAppUserByEmail(normalizedEmail),
  );
}

export async function getCachedActiveAppUserByEmail(email: string) {
  const user = await getCachedAppUserByEmail(email);

  if (!user) {
    return null;
  }

  if (user.status === "blocked") {
    throw new Error("403 User account is blocked.");
  }

  if (user.status === "deleted") {
    throw new Error("403 User account is deleted.");
  }

  return user;
}

export async function getCachedWorkspaceAccessByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  return workspaceAccessCache.getOrLoad(normalizedEmail, () =>
    getWorkspaceAccessByEmail(normalizedEmail),
  );
}

export async function getCachedWorkspaceSnapshotByEmail(email: string) {
  const access = await getCachedWorkspaceAccessByEmail(email);
  return access ? workspaceSnapshotFromAccess(access) : null;
}
