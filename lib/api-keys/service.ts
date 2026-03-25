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
  deleteFugueApiKey,
  disableFugueApiKey,
  enableFugueApiKey,
  getFugueApiKeys,
  rotateFugueApiKey,
  updateFugueApiKey,
} from "@/lib/fugue/api";
import { getFugueEnv } from "@/lib/fugue/env";
import { sortFugueScopes, WORKSPACE_ADMIN_SCOPES } from "@/lib/fugue/scopes";
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

const WORKSPACE_ADMIN_KEY_LABEL = "workspace-admin";

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

function normalizeLabel(label: string) {
  const value = label.trim();

  if (!value) {
    throw new Error("Key name is required.");
  }

  return value;
}

function isWorkspaceAdminLabel(label: string) {
  return label.trim().toLowerCase() === WORKSPACE_ADMIN_KEY_LABEL;
}

function assertAllowedLabel(label: string, options?: { isWorkspaceAdmin?: boolean }) {
  const isWorkspaceAdmin = options?.isWorkspaceAdmin ?? false;

  if (isWorkspaceAdmin) {
    if (!isWorkspaceAdminLabel(label)) {
      throw new Error("Workspace admin key name is fixed.");
    }

    return;
  }

  if (isWorkspaceAdminLabel(label)) {
    throw new Error("workspace-admin is reserved.");
  }
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

function readAllowedScopesForKey(workspaceAdminScopes: string[], isWorkspaceAdmin: boolean) {
  return isWorkspaceAdmin
    ? normalizeScopes([...WORKSPACE_ADMIN_SCOPES, ...workspaceAdminScopes])
    : normalizeScopes(workspaceAdminScopes);
}

function readMutationAccessToken(isWorkspaceAdmin: boolean, workspaceAdminSecret: string) {
  if (isWorkspaceAdmin) {
    return getFugueEnv().bootstrapKey;
  }

  return workspaceAdminSecret;
}

function filterVisibleApiKeysForWorkspace(
  keys: ApiKeyRecord[],
  workspace: NonNullable<Awaited<ReturnType<typeof getWorkspaceAccessByEmail>>>,
) {
  return keys.filter((key) => {
    if (key.id === workspace.adminKeyId) {
      return true;
    }

    if (key.tenantId !== workspace.tenantId) {
      return true;
    }

    if (key.isWorkspaceAdmin || isWorkspaceAdminLabel(key.label)) {
      return false;
    }

    return true;
  });
}

async function persistApiKeyMutation(input: {
  apiKey: {
    createdAt: string | null;
    disabledAt: string | null;
    id: string;
    label: string;
    lastUsedAt: string | null;
    prefix: string | null;
    scopes: string[];
    status: string | null;
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
    keys: filterVisibleApiKeysForWorkspace(keys, workspace),
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
  void email;
  void payload;

  throw new Error(
    "Admin API key is provisioned automatically. Create node keys instead.",
  );
}

export async function createDefaultApiKeyForEmail(email: string) {
  const workspace = await getWorkspaceAccessByEmail(email);

  if (!workspace) {
    throw new Error("Create a workspace first.");
  }

  const rotated = await rotateFugueApiKey(
    readMutationAccessToken(true, workspace.adminKeySecret),
    workspace.adminKeyId,
    {
      label: WORKSPACE_ADMIN_KEY_LABEL,
      scopes: normalizeScopes(
        workspace.adminKeyScopes.length
          ? workspace.adminKeyScopes
          : [...WORKSPACE_ADMIN_SCOPES],
      ),
    },
  );

  const record = await persistApiKeyMutation({
    apiKey: rotated.apiKey,
    email,
    isWorkspaceAdmin: true,
    secret: rotated.secret,
    source: "workspace-admin",
    workspace,
  });

  return {
    key: record,
    secret: rotated.secret,
  };
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

  if (nextLabel !== undefined) {
    assertAllowedLabel(nextLabel, {
      isWorkspaceAdmin: current.isWorkspaceAdmin,
    });
  }

  if (nextScopes) {
    assertSupportedScopes(
      readAllowedScopesForKey(workspace.adminKeyScopes, current.isWorkspaceAdmin),
      nextScopes,
    );
  }

  if (nextLabel === undefined && nextScopes === undefined) {
    throw new Error("Nothing to update.");
  }

  const updated = await updateFugueApiKey(
    readMutationAccessToken(current.isWorkspaceAdmin, workspace.adminKeySecret),
    id,
    {
      label: nextLabel,
      scopes: nextScopes,
    },
  );

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

  const rotated = await rotateFugueApiKey(
    readMutationAccessToken(current.isWorkspaceAdmin, workspace.adminKeySecret),
    id,
    current.isWorkspaceAdmin
      ? {
          label: WORKSPACE_ADMIN_KEY_LABEL,
          scopes: normalizeScopes(
            current.scopes.length ? current.scopes : [...WORKSPACE_ADMIN_SCOPES],
          ),
        }
      : undefined,
  );
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

export async function disableApiKeyForEmail(email: string, id: string) {
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
    throw new Error("Workspace admin key cannot be disabled.");
  }

  const disabled = await disableFugueApiKey(workspace.adminKeySecret, id);
  const record = await persistApiKeyMutation({
    apiKey: disabled,
    email,
    isWorkspaceAdmin: current.isWorkspaceAdmin,
    source: current.source,
    workspace,
  });

  return {
    key: record,
  };
}

export async function enableApiKeyForEmail(email: string, id: string) {
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
    throw new Error("Workspace admin key cannot be enabled.");
  }

  const enabled = await enableFugueApiKey(workspace.adminKeySecret, id);
  const record = await persistApiKeyMutation({
    apiKey: enabled,
    email,
    isWorkspaceAdmin: current.isWorkspaceAdmin,
    source: current.source,
    workspace,
  });

  return {
    key: record,
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

  await deleteFugueApiKey(workspace.adminKeySecret, id);
  const deleted = await setApiKeyStatus(email, id, "deleted");

  if (!deleted) {
    throw new Error("API key not found.");
  }

  return {
    key: deleted,
  };
}
