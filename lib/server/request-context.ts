import "server-only";

import { cache } from "react";

import { ensureAppUserRecord } from "@/lib/app-users/store";
import { getCurrentSession } from "@/lib/auth/session";
import {
  getWorkspaceAccessByEmail,
  getWorkspaceSnapshotByEmail,
} from "@/lib/workspace/store";

export const getRequestSession = cache(async () => getCurrentSession());

const getRequestAppUserRecordCached = cache(async () => {
  const session = await getRequestSession();

  if (!session) {
    return null;
  }

  return ensureAppUserRecord(session);
});

export async function ensureRequestAppUserRecord() {
  return getRequestAppUserRecordCached();
}

export const getRequestWorkspaceSnapshot = cache(async () => {
  const session = await getRequestSession();

  if (!session) {
    return null;
  }

  await getRequestAppUserRecordCached();
  return getWorkspaceSnapshotByEmail(session.email);
});

export const getRequestWorkspaceAccess = cache(async () => {
  const session = await getRequestSession();

  if (!session) {
    return null;
  }

  await getRequestAppUserRecordCached();
  return getWorkspaceAccessByEmail(session.email);
});
