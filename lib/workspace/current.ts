import "server-only";

import { getCurrentSession } from "@/lib/auth/session";
import {
  ensureAppUser,
  getWorkspaceAccessByEmail,
  getWorkspaceSnapshotByEmail,
} from "@/lib/workspace/store";
export type {
  WorkspaceAccess,
  WorkspaceSnapshot,
} from "@/lib/workspace/store";

export async function getCurrentWorkspaceSnapshot() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  await ensureAppUser(session);
  return getWorkspaceSnapshotByEmail(session.email);
}

export async function getCurrentWorkspaceAccess() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  await ensureAppUser(session);
  return getWorkspaceAccessByEmail(session.email);
}
