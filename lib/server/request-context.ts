import "server-only";

import { cache } from "react";

import { ensureAppUserRecord } from "@/lib/app-users/store";
import { getCurrentSession } from "@/lib/auth/session";
import {
  getCachedActiveAppUserByEmail,
  getCachedWorkspaceAccessByEmail,
  getCachedWorkspaceSnapshotByEmail,
} from "@/lib/server/session-state-cache";
import type {
  WorkspaceAccess,
  WorkspaceSnapshot,
} from "@/lib/workspace/store";

export const getRequestSession = cache(async () => getCurrentSession());

const getRequestAppUserRecordCached = cache(async () => {
  const session = await getRequestSession();

  if (!session) {
    return null;
  }

  return getCachedActiveAppUserByEmail(session.email);
});

export async function getRequestAppUserRecord() {
  return getRequestAppUserRecordCached();
}

export async function ensureRequestAppUserRecord() {
  const session = await getRequestSession();

  if (!session) {
    return null;
  }

  const existing = await getRequestAppUserRecordCached();

  if (existing) {
    return existing;
  }

  return ensureAppUserRecord(session);
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
