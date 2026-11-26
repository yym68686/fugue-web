import { NextResponse } from "next/server";
import { isSameOriginJsonWrite } from "@/lib/auth/browser-json-write";
import { readRequestOrigin } from "@/lib/auth/origin";
import { estimateManagedCap, managedCapFromSummary, readManagedCap, sameManagedCap } from "@/lib/billing/managed-cap";
import { withWorkspaceKey } from "@/lib/console/route-helpers";
import { FugueApiError, getBillingSummary, updateTenantBillingCap } from "@/lib/fugue/console";
import { jsonError, readErrorMessage, readErrorStatus, requireActiveSessionUser } from "@/lib/fugue/product-route";
import { runAuditedOutboundAdminMutation } from "@/lib/security/audit";
import { readBoundedJson } from "@/lib/security/read-bounded-json";
import { getWorkspaceAccessByEmail } from "@/lib/workspace/store";

export async function GET() {
  return withWorkspaceKey((key) => getBillingSummary(key, true));
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireActiveSessionUser();
    if (auth.response) return auth.response;
    if (!isSameOriginJsonWrite(request, readRequestOrigin(request))) {
      return jsonError(403, "A same-origin JSON request is required.");
    }

    const cap = readManagedCap(await readBoundedJson(request, 4096));
    if (!cap) return jsonError(400, "Resource caps must be non-negative whole numbers in millicores, MiB, and GiB.");

    // Resolve the owner's workspace from the current database record, not the
    // request or a cached mapping. Confirm the same tenant using its own key
    // before invoking the control plane's administrator-only cap mutation.
    const workspace = await getWorkspaceAccessByEmail(auth.session.email);
    if (!workspace) return jsonError(409, "Create a workspace first.");
    const current = await getBillingSummary(workspace.adminKeySecret);
    if (current?.tenant_id !== workspace.tenantId) {
      return jsonError(409, "Workspace billing could not be verified. Refresh and try again.");
    }
    if (sameManagedCap(cap, managedCapFromSummary(current.managed_cap))) {
      return NextResponse.json({ ok: true, result: current });
    }
    if (!estimateManagedCap(cap, current.price_book)) {
      return jsonError(400, "The estimated cost exceeds the supported range.");
    }

    const billing = await runAuditedOutboundAdminMutation({
      kind: "workspace.billing-cap",
      actorEmail: auth.session.email,
      tenantId: workspace.tenantId,
      cap,
    }, async () => {
      const result = await updateTenantBillingCap(workspace.tenantId, {
        cpu_millicores: cap.cpuMillicores,
        memory_mebibytes: cap.memoryMebibytes,
        storage_gibibytes: cap.storageGibibytes,
      });
      if (result?.tenant_id !== workspace.tenantId) {
        throw new FugueApiError(502, "Workspace billing update could not be verified.");
      }
      return result;
    });
    return NextResponse.json({ ok: true, result: billing });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
