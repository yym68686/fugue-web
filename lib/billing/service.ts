import "server-only";

import {
  getFugueBillingSummary,
  topUpFugueBilling,
  updateFugueBilling,
  type FugueBillingSummary,
  type FugueResourceSpec,
} from "@/lib/fugue/api";
import { getWorkspaceAccessByEmail } from "@/lib/workspace/store";

export type BillingPageData = {
  billing: FugueBillingSummary | null;
  syncError: string | null;
  workspace: {
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

async function requireWorkspaceAccess(email: string) {
  const workspace = await getWorkspaceAccessByEmail(email);

  if (!workspace) {
    throw new Error("409 Create a workspace first.");
  }

  return workspace;
}

export async function getBillingPageData(email: string) {
  const workspace = await getWorkspaceAccessByEmail(email);

  if (!workspace) {
    return null;
  }

  try {
    const billing = await getFugueBillingSummary(workspace.adminKeySecret);

    return {
      billing,
      syncError: null,
      workspace: {
        tenantId: workspace.tenantId,
        tenantName: workspace.tenantName,
      },
    } satisfies BillingPageData;
  } catch (error) {
    return {
      billing: null,
      syncError: readErrorMessage(error),
      workspace: {
        tenantId: workspace.tenantId,
        tenantName: workspace.tenantName,
      },
    } satisfies BillingPageData;
  }
}

export async function updateBillingForEmail(
  email: string,
  payload: {
    managedCap: FugueResourceSpec;
  },
) {
  const workspace = await requireWorkspaceAccess(email);
  const storageGibibytes =
    payload.managedCap.storageGibibytes ??
    (await getFugueBillingSummary(workspace.adminKeySecret)).managedCap.storageGibibytes;

  return updateFugueBilling(workspace.adminKeySecret, {
    managedCap: {
      ...payload.managedCap,
      storageGibibytes,
    },
  });
}

export async function topUpBillingForEmail(
  email: string,
  payload: {
    amountCents: number;
    note?: string;
  },
) {
  const workspace = await requireWorkspaceAccess(email);

  return topUpFugueBilling(workspace.adminKeySecret, {
    amountCents: payload.amountCents,
    note: payload.note,
  });
}
