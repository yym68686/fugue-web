import { NextResponse } from "next/server";

import { requireAdminRoute } from "@/lib/admin/route";
import { setAppUserStatus } from "@/lib/app-users/store";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readJsonBody,
} from "@/lib/fugue/product-route";

/**
 * Ban / unban a user. Local-only: flips app_users.status between 'active' and
 * 'blocked' (and bumps session_version to force re-auth). The store guards
 * against blocking admins and restoring deleted users. Platform-admin only.
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
    return NextResponse.json({
      ok: true,
      result: { email: updated.email, status: updated.status },
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
