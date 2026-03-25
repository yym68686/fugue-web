import "server-only";

import {
  getApiKeyRecordById,
  listApiKeysByEmail,
  saveApiKeyRecord,
  setApiKeyStatus,
  syncApiKeysForWorkspace,
} from "@/lib/api-keys/store";
import type { ApiKeyRecord } from "@/lib/api-keys/types";
import {
  createFugueApiKey,
  getFugueApiKeys,
  rotateFugueApiKey,
  updateFugueApiKey,
} from "@/lib/fugue/api";
import { sortFugueScopes } from "@/lib/fugue/scopes";
import {
  getWorkspaceAccessByEmail,
  saveWorkspaceAccess,
} from "@/lib/workspace/store";

export type ApiKeyPageData = {
  availableScopes: string[];
  keys: ApiKeyRecord[];
  syncError: string | null;
  workspace: {
    adminKeyId: string;
  };
};

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Request failed.";
}

function normalizeScopes(scopes: string[]) {
  return sortFugueScopes(
    scopes.filter((scope) => typeof scope === "string" && scope.trim().length > 0),
  );
}

function buildDefaultKeyLabel(keys: Array<Pick<ApiKeyRecord, "label">>) {
  const used = new Set(
    keys
      .map((key) => key.label.trim().toLowerCase())
      .filter((label) => label.length > 0),
  );

  if (!used.has("key")) {
    return "key";
  }

  let index = 2;

  while (used.has(`key-${index}`)) {
    index += 1;
  }

  return `key-${index}`;
}

function normalizeLabel(label: string) {
  const value = label.trim();

  if (!value) {
    throw new Error("Key name is required.");
  }

  return value;
}

function assertSupportedScopes(allowedScopes: string[], scopes: string[]) {
  if (!scopes.length) {
    throw new Error("Choose at least one scope.");
  }

  const invalidScopes = scopes.filter((scope) => !allowedScopes.includes(scope));

  if (invalidScopes.length) {
    throw new Error(`Unsupported scopes: ${invalidScopes.join(", ")}`);
  }
}

async function persistApiKeyMutation(input: {
  apiKey: {
    createdAt: string | null;
    id: string;
    label: string;
    lastUsedAt: string | null;
    prefix: string | null;
    scopes: string[];
  };
  email: string;
  isWorkspaceAdmin: boolean;
  secret?: string;
  source: ApiKeyRecord["source"];
  workspace: NonNullable<Awaited<ReturnType<typeof getWorkspaceAccessByEmail>>>;
}) {
  const { apiKey, email, isWorkspaceAdmin, secret, source, workspace } = input;

  if (isWorkspaceAdmin) {
    await saveWorkspaceAccess({
      ...workspace,
      adminKeyId: apiKey.id,
      adminKeyLabel: apiKey.label,
      adminKeyPrefix: apiKey.prefix,
      adminKeyScopes: normalizeScopes(apiKey.scopes),
      adminKeySecret: secret ?? workspace.adminKeySecret,
      updatedAt: new Date().toISOString(),
    });

    const record = await getApiKeyRecordById(email, apiKey.id);

    if (!record) {
      throw new Error("Failed to persist API key.");
    }

    return record;
  }

  return saveApiKeyRecord({
    apiKey,
    email,
    secret,
    source,
    tenantId: workspace.tenantId,
  });
}

export async function getApiKeyPageData(email: string) {
  const workspace = await getWorkspaceAccessByEmail(email);

  if (!workspace) {
    return null;
  }

  let keys: ApiKeyRecord[] = [];
  let syncError: string | null = null;

  try {
    const visibleKeys = await getFugueApiKeys(workspace.adminKeySecret);
    keys = await syncApiKeysForWorkspace({
      email,
      tenantId: workspace.tenantId,
      visibleKeys,
    });
  } catch (error) {
    keys = await listApiKeysByEmail(email, {
      tenantId: workspace.tenantId,
    });
    syncError = readErrorMessage(error);
  }

  return {
    availableScopes: normalizeScopes(workspace.adminKeyScopes),
    keys,
    syncError,
    workspace: {
      adminKeyId: workspace.adminKeyId,
    },
  } satisfies ApiKeyPageData;
}

export async function createApiKeyForEmail(
  email: string,
  payload: {
    label: string;
    scopes: string[];
  },
) {
  const workspace = await getWorkspaceAccessByEmail(email);

  if (!workspace) {
    throw new Error("Create a workspace first.");
  }

  const label = normalizeLabel(payload.label);
  const scopes = normalizeScopes(payload.scopes);

  assertSupportedScopes(workspace.adminKeyScopes, scopes);

  const created = await createFugueApiKey(workspace.adminKeySecret, {
    label,
    scopes,
    tenantId: workspace.tenantId,
  });

  const record = await saveApiKeyRecord({
    apiKey: created.apiKey,
    email,
    secret: created.secret,
    source: "managed",
    tenantId: workspace.tenantId,
  });

  return {
    key: record,
    secret: created.secret,
  };
}

export async function createDefaultApiKeyForEmail(email: string) {
  const workspace = await getWorkspaceAccessByEmail(email);

  if (!workspace) {
    throw new Error("Create a workspace first.");
  }

  const existingKeys = await listApiKeysByEmail(email, {
    tenantId: workspace.tenantId,
  });

  return createApiKeyForEmail(email, {
    label: buildDefaultKeyLabel(existingKeys),
    scopes: normalizeScopes(workspace.adminKeyScopes),
  });
}

export async function updateApiKeyForEmail(
  email: string,
  id: string,
  payload: {
    label?: string;
    scopes?: string[];
  },
) {
  const workspace = await getWorkspaceAccessByEmail(email);

  if (!workspace) {
    throw new Error("Create a workspace first.");
  }

  const current = await getApiKeyRecordById(email, id, {
    includeDeleted: true,
  });

  if (!current || current.status === "deleted") {
    throw new Error("API key not found.");
  }

  const nextLabel =
    payload.label === undefined ? undefined : normalizeLabel(payload.label);
  const nextScopes =
    payload.scopes === undefined ? undefined : normalizeScopes(payload.scopes);

  if (nextScopes) {
    assertSupportedScopes(workspace.adminKeyScopes, nextScopes);
  }

  if (nextLabel === undefined && nextScopes === undefined) {
    throw new Error("Nothing to update.");
  }

  const updated = await updateFugueApiKey(workspace.adminKeySecret, id, {
    label: nextLabel,
    scopes: nextScopes,
  });

  const record = await persistApiKeyMutation({
    apiKey: updated,
    email,
    isWorkspaceAdmin: current.isWorkspaceAdmin,
    source: current.source,
    workspace,
  });

  return {
    key: record,
  };
}

export async function rotateApiKeyForEmail(email: string, id: string) {
  const workspace = await getWorkspaceAccessByEmail(email);

  if (!workspace) {
    throw new Error("Create a workspace first.");
  }

  const current = await getApiKeyRecordById(email, id, {
    includeDeleted: true,
  });

  if (!current || current.status === "deleted") {
    throw new Error("API key not found.");
  }

  const rotated = await rotateFugueApiKey(workspace.adminKeySecret, id);
  const record = await persistApiKeyMutation({
    apiKey: rotated.apiKey,
    email,
    isWorkspaceAdmin: current.isWorkspaceAdmin,
    secret: rotated.secret,
    source: current.source,
    workspace,
  });

  return {
    key: record,
    secret: rotated.secret,
  };
}

export async function deleteApiKeyForEmail(email: string, id: string) {
  const workspace = await getWorkspaceAccessByEmail(email);

  if (!workspace) {
    throw new Error("Create a workspace first.");
  }

  const current = await getApiKeyRecordById(email, id, {
    includeDeleted: true,
  });

  if (!current || current.status === "deleted") {
    throw new Error("API key not found.");
  }

  if (current.isWorkspaceAdmin) {
    throw new Error("Workspace admin key cannot be deleted.");
  }

  const deleted = await setApiKeyStatus(email, id, "deleted");

  if (!deleted) {
    throw new Error("API key not found.");
  }

  return {
    key: deleted,
  };
}
