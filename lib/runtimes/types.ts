export type RuntimeOwnership = "owned" | "shared" | "internal-cluster";

export type RuntimeShareGrantView = {
  createdAt: string | null;
  email: string | null;
  label: string;
  tenantId: string;
  updatedAt: string | null;
};

export type RuntimePricingResourceSpecView = {
  cpuMillicores: number;
  memoryMebibytes: number;
  storageGibibytes: number;
};

export type RuntimePricingBookView = {
  cpuMicroCentsPerMillicoreHour: number;
  currency: string;
  hoursPerMonth: number;
  memoryMicroCentsPerMibHour: number;
  storageMicroCentsPerGibHour: number;
};

export type RuntimePublicOfferView = {
  free: boolean;
  freeCpu: boolean;
  freeMemory: boolean;
  freeStorage: boolean;
  priceBook: RuntimePricingBookView;
  referenceBundle: RuntimePricingResourceSpecView;
  referenceMonthlyPriceMicroCents: number;
  updatedAt: string | null;
};

export type RuntimeSharingView = {
  accessMode: string | null;
  grants: RuntimeShareGrantView[];
  ownerEmail: string | null;
  ownerTenantId: string | null;
  poolMode: string | null;
  publicOffer: RuntimePublicOfferView | null;
  runtimeId: string;
  runtimeType: string | null;
};
