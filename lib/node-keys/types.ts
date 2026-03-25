export type NodeKeyStatus = "active" | "revoked";
export type NodeKeySource = "managed" | "external";

export type NodeKeyRecord = {
  canCopy: boolean;
  canRevoke: boolean;
  createdAt: string;
  hash: string | null;
  id: string;
  label: string;
  lastSyncedAt: string | null;
  lastUsedAt: string | null;
  prefix: string | null;
  revokedAt: string | null;
  secretStored: boolean;
  source: NodeKeySource;
  status: NodeKeyStatus;
  tenantId: string;
  updatedAt: string;
  userEmail: string;
};
