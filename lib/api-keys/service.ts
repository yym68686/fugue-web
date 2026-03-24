import "server-only";

import {
  listApiKeysByEmail,
  saveApiKeyRecord,
  syncApiKeysForWorkspace,
} from "@/lib/api-keys/store";
import type { ApiKeyRecord } from "@/lib/api-keys/types";
import {
  createFugueApiKey,
  getFugueApiKeys,
} from "@/lib/fugue/api";
import { sortFugueScopes } from "@/lib/fugue/scopes";
import { getWorkspaceAccessByEmail } from "@/lib/workspace/store";

export type ApiKeyPageData = {
  availableScopes: string[];
  keys: ApiKeyRecord[];
  syncError: string | null;
  workspace: {
    adminKeyId: string;
    tenantId: string;
    tenantName: string;
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
      tenantId: workspace.tenantId,
      tenantName: workspace.tenantName,
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

  const label = payload.label.trim();
  const scopes = normalizeScopes(payload.scopes);

  if (!label) {
    throw new Error("Key label is required.");
  }

  if (!scopes.length) {
    throw new Error("Choose at least one scope.");
  }

  const invalidScopes = scopes.filter(
    (scope) => !workspace.adminKeyScopes.includes(scope),
  );

  if (invalidScopes.length) {
    throw new Error(`Unsupported scopes: ${invalidScopes.join(", ")}`);
  }

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
