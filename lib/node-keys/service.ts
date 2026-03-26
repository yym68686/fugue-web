import "server-only";

import {
  getNodeKeyRecordById,
  listNodeKeysByEmail,
  saveNodeKeyRecord,
  syncNodeKeysForWorkspace,
} from "@/lib/node-keys/store";
import type { NodeKeyRecord } from "@/lib/node-keys/types";
import {
  createFugueNodeKey,
  getFugueNodeKeys,
  revokeFugueNodeKey,
} from "@/lib/fugue/api";
import { getWorkspaceAccessByEmail } from "@/lib/workspace/store";

export type NodeKeyPageData = {
  keys: NodeKeyRecord[];
  syncError: string | null;
};

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Request failed.";
}

function buildDefaultNodeKeyLabel(keys: Array<Pick<NodeKeyRecord, "label">>) {
  const used = new Set(
    keys
      .map((key) => key.label.trim().toLowerCase())
      .filter((label) => label.length > 0),
  );

  if (!used.has("node")) {
    return "node";
  }

  let index = 2;

  while (used.has(`node-${index}`)) {
    index += 1;
  }

  return `node-${index}`;
}

function filterVisibleNodeKeys(keys: NodeKeyRecord[]) {
  return keys.filter((key) => key.status === "active");
}

function hasCopyableNodeKey(keys: NodeKeyRecord[]) {
  return keys.some((key) => key.canCopy);
}

function normalizeLabel(label: string) {
  const value = label.trim();

  if (!value) {
    throw new Error("Node key name is required.");
  }

  return value;
}

export async function getNodeKeyPageData(
  email: string,
  options?: {
    ensureCopyableDefault?: boolean;
  },
) {
  const workspace = await getWorkspaceAccessByEmail(email);

  if (!workspace) {
    return null;
  }

  let keys: NodeKeyRecord[] = [];
  let syncError: string | null = null;

  try {
    const visibleKeys = await getFugueNodeKeys(workspace.adminKeySecret);
    keys = await syncNodeKeysForWorkspace({
      email,
      tenantId: workspace.tenantId,
      visibleKeys,
    });
  } catch (error) {
    keys = await listNodeKeysByEmail(email, {
      tenantId: workspace.tenantId,
    });
    syncError = readErrorMessage(error);
  }

  let visibleKeys = filterVisibleNodeKeys(keys);

  if (options?.ensureCopyableDefault && !hasCopyableNodeKey(visibleKeys)) {
    try {
      const created = await createDefaultNodeKeyForEmail(email);
      visibleKeys = filterVisibleNodeKeys([created.key, ...visibleKeys]);
      syncError = null;
    } catch (error) {
      syncError ??= readErrorMessage(error);
    }
  }

  return {
    keys: visibleKeys,
    syncError,
  } satisfies NodeKeyPageData;
}

export async function createNodeKeyForEmail(
  email: string,
  payload?: {
    label?: string;
  },
) {
  const workspace = await getWorkspaceAccessByEmail(email);

  if (!workspace) {
    throw new Error("Create a workspace first.");
  }

  const created = await createFugueNodeKey(workspace.adminKeySecret, {
    ...(payload?.label !== undefined
      ? {
          label: normalizeLabel(payload.label),
        }
      : {}),
    tenantId: workspace.tenantId,
  });

  const record = await saveNodeKeyRecord({
    email,
    nodeKey: created.nodeKey,
    secret: created.secret,
    source: "managed",
    tenantId: workspace.tenantId,
  });

  return {
    key: record,
    secret: created.secret,
  };
}

export async function createDefaultNodeKeyForEmail(email: string) {
  const workspace = await getWorkspaceAccessByEmail(email);

  if (!workspace) {
    throw new Error("Create a workspace first.");
  }

  const existingKeys = await listNodeKeysByEmail(email, {
    tenantId: workspace.tenantId,
  });

  return createNodeKeyForEmail(email, {
    label: buildDefaultNodeKeyLabel(filterVisibleNodeKeys(existingKeys)),
  });
}

export async function revokeNodeKeyForEmail(email: string, id: string) {
  const workspace = await getWorkspaceAccessByEmail(email);

  if (!workspace) {
    throw new Error("Create a workspace first.");
  }

  const current = await getNodeKeyRecordById(email, id);

  if (!current) {
    throw new Error("Node key not found.");
  }

  const revoked = await revokeFugueNodeKey(workspace.adminKeySecret, id);
  const record = await saveNodeKeyRecord({
    email,
    nodeKey: revoked,
    source: current.source,
    tenantId: workspace.tenantId,
  });

  return {
    key: record,
  };
}
