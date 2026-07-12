import "server-only";

import { cache } from "react";

import {
  getCurrentActiveSessionUser,
  SessionAuthorizationError,
} from "@/lib/auth/session";
import {
  getCachedWorkspaceAccessByEmail,
  getCachedWorkspaceSnapshotByEmail,
} from "@/lib/server/session-state-cache";
import type { WorkspaceAccess, WorkspaceSnapshot } from "@/lib/workspace/store";

const getRequestActiveSessionUser = cache(async () => {
  try {
    return await getCurrentActiveSessionUser();
  } catch (error) {
    if (error instanceof SessionAuthorizationError) {
      return null;
    }

    throw error;
  }
});

export const getRequestSession = cache(async () => {
  const current = await getRequestActiveSessionUser();
  return current?.session ?? null;
});

const getRequestAppUserRecordCached = cache(async () => {
  const current = await getRequestActiveSessionUser();
  return current?.user ?? null;
});

export async function getRequestAppUserRecord() {
  return getRequestAppUserRecordCached();
}

export const getRequestWorkspaceSnapshot = cache(
  async (): Promise<WorkspaceSnapshot | null> => {
    const session = await getRequestSession();

    if (!session) {
      return null;
    }

    return getCachedWorkspaceSnapshotByEmail(session.email);
  },
);

export const getRequestWorkspaceAccess = cache(
  async (): Promise<WorkspaceAccess | null> => {
    const session = await getRequestSession();

    if (!session) {
      return null;
    }

    return getCachedWorkspaceAccessByEmail(session.email);
  },
);
