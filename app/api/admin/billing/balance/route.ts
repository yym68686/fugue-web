import { NextResponse } from "next/server";

import { requireAdminRoute } from "@/lib/admin/route";
import { setTenantBillingBalance } from "@/lib/fugue/console";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readJsonBody,
} from "@/lib/fugue/product-route";

/**
 * Set (overwrite) any tenant's prepaid balance as a platform admin. `balanceCents`
 * is the target balance in whole cents; the backend converts to microcents and
 * records an audit entry. Platform-admin only (enforced here and on the backend).
 */
export async function POST(request: Request) {
  const auth = await requireAdminRoute();
  if (auth.response) return auth.response;

  const body = (await readJsonBody(request)) as Record<string, unknown> | null;
  const tenantId =
    body && typeof body.tenantId === "string" ? body.tenantId.trim() : "";
  if (!tenantId) return jsonError(400, "A tenant id is required.");

  const raw = body?.balanceCents;
  const balanceCents = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(balanceCents) || balanceCents < 0) {
    return jsonError(400, "balanceCents must be a non-negative number.");
  }

  const note =
    body && typeof body.note === "string" && body.note.trim()
      ? body.note.trim()
      : undefined;

  try {
    const billing = await setTenantBillingBalance(
      tenantId,
      Math.round(balanceCents),
      note,
    );
    return NextResponse.json({ ok: true, result: billing });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
