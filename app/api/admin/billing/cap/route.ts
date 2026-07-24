import { NextResponse } from "next/server";

import { requireAdminRoute } from "@/lib/admin/route";
import {
  updateTenantBillingCap,
  type BillingResourceSpec,
} from "@/lib/fugue/console";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readJsonBody,
} from "@/lib/fugue/product-route";

/** Read a non-negative integer field, or null if absent/blank; false if invalid. */
function readCount(value: unknown): number | null | false {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return false;
  return Math.round(n);
}

/**
 * Adjust any tenant's managed resource cap (CPU millicores / memory MiB /
 * storage GiB) as a platform admin. Uses the bootstrap key with an explicit
 * tenant_id. Platform-admin only.
 */
export async function POST(request: Request) {
  const auth = await requireAdminRoute();
  if (auth.response) return auth.response;

  const body = (await readJsonBody(request)) as Record<string, unknown> | null;
  const tenantId =
    body && typeof body.tenantId === "string" ? body.tenantId.trim() : "";
  if (!tenantId) return jsonError(400, "A tenant id is required.");

  const cpu = readCount(body?.cpuMillicores);
  const memory = readCount(body?.memoryMebibytes);
  const storage = readCount(body?.storageGibibytes);
  if (cpu === false || memory === false || storage === false) {
    return jsonError(400, "Resource limits must be non-negative numbers.");
  }

  const cap: BillingResourceSpec = {
    cpu_millicores: cpu ?? 0,
    memory_mebibytes: memory ?? 0,
  };
  // Only touch storage when the caller sent a value, so we never clobber the
  // backend's storage default for tenants that don't manage storage.
  if (storage !== null) cap.storage_gibibytes = storage;

  try {
    const billing = await updateTenantBillingCap(tenantId, cap);
    return NextResponse.json({ ok: true, result: billing });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
