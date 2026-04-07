import { NextResponse } from "next/server";

import { updateAppUserProfile } from "@/lib/app-users/store";
import { isSecureRequest } from "@/lib/auth/origin";
import { buildSessionCookie, getCurrentSession } from "@/lib/auth/session";
import { sanitizeDisplayName } from "@/lib/auth/validation";
import { jsonError, readErrorMessage, readErrorStatus } from "@/lib/fugue/product-route";

type RequestPayload = {
  name?: string;
};

export async function PATCH(request: Request) {
  const session = await getCurrentSession();

  if (!session) {
    return jsonError(401, "Sign in first.");
  }

  let payload: RequestPayload;

  try {
    payload = (await request.json()) as RequestPayload;
  } catch {
    return jsonError(400, "Invalid request payload.");
  }

  const name = sanitizeDisplayName(payload.name ?? "");

  if (name.length > 80) {
    return jsonError(400, "Display name is too long.");
  }

  try {
    const user = await updateAppUserProfile(session.email, { name });
    const response = NextResponse.json({
      ok: true,
      user,
    });

    response.cookies.set({
      ...buildSessionCookie({
        ...session,
        name: user.name ?? undefined,
      }),
      secure: isSecureRequest(request),
    });

    return response;
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
