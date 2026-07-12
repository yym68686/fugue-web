import "server-only";

import { normalizeEmail } from "@/lib/auth/validation";
import { createExpiringAsyncCache } from "@/lib/server/expiring-async-cache";
import type { WorkspaceAccess, WorkspaceSnapshot } from "@/lib/workspace/store";
import { getWorkspaceAccessByEmail } from "@/lib/workspace/store";

const SESSION_STATE_CACHE_TTL_MS = 60_000;

const workspaceAccessCache = createExpiringAsyncCache<WorkspaceAccess | null>(
  SESSION_STATE_CACHE_TTL_MS,
);

function workspaceSnapshotFromAccess(access: WorkspaceAccess): WorkspaceSnapshot {
  const { adminKeySecret: _adminKeySecret, ...snapshot } = access;
  return snapshot;
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

export function invalidateCachedWorkspaceAccessByEmail(email: string) {
  workspaceAccessCache.clear(normalizeEmail(email));
}
