import "server-only";

import { getAppUserByEmail } from "@/lib/app-users/store";
import { normalizeEmail, isValidEmail } from "@/lib/auth/validation";
import {
  getFugueRuntimeSharing,
  grantFugueRuntimeAccess,
  revokeFugueRuntimeAccess,
  setFugueRuntimeAccessMode,
  setFugueRuntimePoolMode,
  setFugueRuntimePublicOffer,
} from "@/lib/fugue/api";
import { getFugueEnv } from "@/lib/fugue/env";
import {
  getWorkspaceAccessByEmail,
  getWorkspaceSnapshotByEmail,
  getWorkspaceSnapshotByTenantId,
  type WorkspaceAccess,
  type WorkspaceSnapshot,
} from "@/lib/workspace/store";
import type {
  RuntimePublicOfferView,
  RuntimeShareGrantView,
  RuntimeSharingView,
} from "@/lib/runtimes/types";

function shortId(value: string) {
  return value.length <= 18 ? value : `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function sortGrants(grants: RuntimeShareGrantView[]) {
  return [...grants].sort((left, right) => {
    const leftEmail = left.email ?? left.label;
    const rightEmail = right.email ?? right.label;
    return leftEmail.localeCompare(rightEmail, "en", { sensitivity: "base" });
  });
}

function readTargetWorkspaceLabel(
  workspace: WorkspaceSnapshot | null,
  tenantId: string,
) {
  if (workspace?.email) {
    return workspace.email;
  }

  return `Tenant ${shortId(tenantId)}`;
}

function buildRuntimePublicOfferView(
  offer: Awaited<
    ReturnType<typeof getFugueRuntimeSharing>
  >["runtime"]["publicOffer"],
) {
  if (!offer) {
    return null;
  }

  return {
    free: offer.free,
    freeCpu: offer.freeCpu,
    freeMemory: offer.freeMemory,
    freeStorage: offer.freeStorage,
    priceBook: {
      cpuMicroCentsPerMillicoreHour:
        offer.priceBook.cpuMicroCentsPerMillicoreHour,
      currency: offer.priceBook.currency,
      hoursPerMonth: offer.priceBook.hoursPerMonth,
      memoryMicroCentsPerMibHour: offer.priceBook.memoryMicroCentsPerMibHour,
      storageMicroCentsPerGibHour: offer.priceBook.storageMicroCentsPerGibHour,
    },
    referenceBundle: {
      cpuMillicores: offer.referenceBundle.cpuMillicores,
      memoryMebibytes: offer.referenceBundle.memoryMebibytes,
      storageGibibytes: offer.referenceBundle.storageGibibytes,
    },
    referenceMonthlyPriceMicroCents: offer.referenceMonthlyPriceMicroCents,
    updatedAt: offer.updatedAt,
  } satisfies RuntimePublicOfferView;
}

async function requireWorkspaceAccess(email: string) {
  const workspace = await getWorkspaceAccessByEmail(email);

  if (!workspace) {
    throw new Error("409 Create a workspace first.");
  }

  return workspace;
}

async function buildRuntimeSharingView(
  workspace: WorkspaceAccess,
  runtimeId: string,
): Promise<RuntimeSharingView> {
  const sharing = await getFugueRuntimeSharing(
    workspace.adminKeySecret,
    runtimeId,
  );

  if (!sharing.runtime) {
    throw new Error("404 Runtime not found.");
  }

  const ownerWorkspace = sharing.runtime.tenantId
    ? await getWorkspaceSnapshotByTenantId(sharing.runtime.tenantId)
    : null;
  const grants = await Promise.all(
    sharing.grants.map(async (grant) => {
      const targetWorkspace = await getWorkspaceSnapshotByTenantId(
        grant.tenantId,
      );

      return {
        createdAt: grant.createdAt,
        email: targetWorkspace?.email ?? null,
        label: readTargetWorkspaceLabel(targetWorkspace, grant.tenantId),
        tenantId: grant.tenantId,
        updatedAt: grant.updatedAt,
      } satisfies RuntimeShareGrantView;
    }),
  );

  return {
    accessMode: sharing.runtime.accessMode,
    grants: sortGrants(grants),
    ownerEmail: ownerWorkspace?.email ?? null,
    ownerTenantId: sharing.runtime.tenantId,
    poolMode: sharing.runtime.poolMode,
    publicOffer: buildRuntimePublicOfferView(sharing.runtime.publicOffer),
    runtimeId: sharing.runtime.id,
    runtimeType: sharing.runtime.type,
  } satisfies RuntimeSharingView;
}

async function resolveShareTargetWorkspace(
  currentEmail: string,
  workspace: WorkspaceAccess,
  targetEmail: string,
) {
  const normalizedEmail = normalizeEmail(targetEmail);

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    throw new Error("400 Enter a valid email address.");
  }

  if (normalizedEmail === normalizeEmail(currentEmail)) {
    throw new Error("400 This server already belongs to your workspace.");
  }

  const targetWorkspace = await getWorkspaceSnapshotByEmail(normalizedEmail);

  if (targetWorkspace) {
    if (targetWorkspace.tenantId === workspace.tenantId) {
      throw new Error("400 This server already belongs to your workspace.");
    }

    return targetWorkspace;
  }

  const existingUser = await getAppUserByEmail(normalizedEmail);

  if (existingUser) {
    throw new Error(
      "409 This user needs to finish workspace setup before you can share a server.",
    );
  }

  throw new Error("404 No Fugue user with this email was found.");
}

export async function readRuntimeSharingForEmail(
  email: string,
  runtimeId: string,
) {
  const workspace = await requireWorkspaceAccess(email);
  return buildRuntimeSharingView(workspace, runtimeId);
}

export async function grantRuntimeShareForEmail(
  email: string,
  runtimeId: string,
  targetEmail: string,
) {
  const workspace = await requireWorkspaceAccess(email);
  const targetWorkspace = await resolveShareTargetWorkspace(
    email,
    workspace,
    targetEmail,
  );

  await grantFugueRuntimeAccess(workspace.adminKeySecret, runtimeId, {
    tenantId: targetWorkspace.tenantId,
  });

  return buildRuntimeSharingView(workspace, runtimeId);
}

export async function revokeRuntimeShareForEmail(
  email: string,
  runtimeId: string,
  tenantId: string,
) {
  const workspace = await requireWorkspaceAccess(email);

  await revokeFugueRuntimeAccess(
    workspace.adminKeySecret,
    runtimeId,
    tenantId.trim(),
  );

  return buildRuntimeSharingView(workspace, runtimeId);
}

export async function setRuntimePoolModeForEmail(
  email: string,
  runtimeId: string,
  poolMode: string,
) {
  const workspace = await requireWorkspaceAccess(email);
  const sharing = await buildRuntimeSharingView(workspace, runtimeId);

  if (!sharing.ownerTenantId || sharing.ownerTenantId !== workspace.tenantId) {
    throw new Error("403 Only the runtime owner can manage pool mode.");
  }

  return setFugueRuntimePoolMode(getFugueEnv().bootstrapKey, runtimeId, {
    poolMode,
  });
}

export async function setRuntimeAccessModeForEmail(
  email: string,
  runtimeId: string,
  accessMode: string,
) {
  const workspace = await requireWorkspaceAccess(email);
  const sharing = await buildRuntimeSharingView(workspace, runtimeId);

  if (!sharing.ownerTenantId || sharing.ownerTenantId !== workspace.tenantId) {
    throw new Error("403 Only the runtime owner can manage visibility.");
  }

  await setFugueRuntimeAccessMode(workspace.adminKeySecret, runtimeId, {
    accessMode,
  });

  return buildRuntimeSharingView(workspace, runtimeId);
}

export async function setRuntimePublicOfferForEmail(
  email: string,
  runtimeId: string,
  payload: {
    free?: boolean;
    freeCpu?: boolean;
    freeMemory?: boolean;
    freeStorage?: boolean;
    referenceBundle?: {
      cpuMillicores?: number;
      memoryMebibytes?: number;
      storageGibibytes?: number;
    };
    referenceMonthlyPriceMicroCents?: number;
  },
) {
  const workspace = await requireWorkspaceAccess(email);
  const sharing = await buildRuntimeSharingView(workspace, runtimeId);

  if (!sharing.ownerTenantId || sharing.ownerTenantId !== workspace.tenantId) {
    throw new Error("403 Only the runtime owner can manage public pricing.");
  }

  await setFugueRuntimePublicOffer(
    workspace.adminKeySecret,
    runtimeId,
    payload,
  );

  return buildRuntimeSharingView(workspace, runtimeId);
}
