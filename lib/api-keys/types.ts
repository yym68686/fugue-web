export type ApiKeyStatus = "active" | "disabled" | "deleted";
export type ApiKeySource = "workspace-admin" | "managed" | "external";

export type ApiKeyRecord = {
  canCopy: boolean;
  canDelete: boolean;
  canDisable: boolean;
  createdAt: string;
  deletedAt: string | null;
  disabledAt: string | null;
  id: string;
  isWorkspaceAdmin: boolean;
  label: string;
  lastSyncedAt: string | null;
  lastUsedAt: string | null;
  prefix: string | null;
  scopes: string[];
  secretStored: boolean;
  source: ApiKeySource;
  status: ApiKeyStatus;
  tenantId: string;
  updatedAt: string;
  userEmail: string;
};
