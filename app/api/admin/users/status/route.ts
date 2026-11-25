import { NextResponse } from "next/server";

import { requireAdminRoute } from "@/lib/admin/route";
import { setAppUserStatus } from "@/lib/app-users/store";
import { deliverWorkspaceHold } from "@/lib/workspace/access-holds";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readJsonBody,
} from "@/lib/fugue/product-route";

/**
 * Save the Web session revocation and workspace hold intent atomically.
 * The worker retries control-plane delivery after outages.
 */
export async function POST(request: Request) {
  const auth = await requireAdminRoute();
  if (auth.response) return auth.response;

  const body = await readJsonBody(request);
  const email =
    body && typeof body === "object" && typeof (body as { email?: unknown }).email === "string"
      ? (body as { email: string }).email.trim()
      : "";
  const status =
    body && typeof body === "object" ? (body as { status?: unknown }).status : undefined;

  if (!email) return jsonError(400, "A user email is required.");
  if (status !== "active" && status !== "blocked") {
    return jsonError(400, "status must be 'active' or 'blocked'.");
  }

  try {
    const updated = await setAppUserStatus(email, status, {
      actorEmail: auth.session.email,
    });
    if (!await deliverWorkspaceHold(updated.email)) {
      return jsonError(503, "Web account status saved. Control-plane access update is pending and will retry.");
    }
    return NextResponse.json({
      ok: true,
      result: { email: updated.email, status: updated.status },
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
