import "server-only";

import {
  getRequestWorkspaceAccess,
  getRequestWorkspaceSnapshot,
} from "@/lib/server/request-context";
export type {
  WorkspaceAccess,
  WorkspaceSnapshot,
} from "@/lib/workspace/store";

export async function getCurrentWorkspaceSnapshot() {
  return getRequestWorkspaceSnapshot();
}

export async function getCurrentWorkspaceAccess() {
  return getRequestWorkspaceAccess();
}
