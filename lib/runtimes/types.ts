export type RuntimeOwnership = "owned" | "shared" | "internal-cluster";

export type RuntimeShareGrantView = {
  createdAt: string | null;
  email: string | null;
  label: string;
  tenantId: string;
  updatedAt: string | null;
};

export type RuntimeSharingView = {
  accessMode: string | null;
  grants: RuntimeShareGrantView[];
  ownerEmail: string | null;
  ownerTenantId: string | null;
  poolMode: string | null;
  runtimeId: string;
  runtimeType: string | null;
};
