import { NextResponse } from "next/server";

import { updateAppUserProfile } from "@/lib/app-users/store";
import { isSecureRequest } from "@/lib/auth/origin";
import { AuthRequestTooLargeError, readLimitedJson } from "@/lib/auth/request";
import { buildSessionCookie, getCurrentSession } from "@/lib/auth/session";
import {
  AUTH_DISPLAY_NAME_MAX_LENGTH,
  sanitizeDisplayName,
} from "@/lib/auth/validation";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
} from "@/lib/fugue/product-route";

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
    payload = await readLimitedJson<RequestPayload>(request, 8 * 1_024);
  } catch (error) {
    return jsonError(
      error instanceof AuthRequestTooLargeError ? 413 : 400,
      error instanceof AuthRequestTooLargeError
        ? "Authentication request payload is too large."
        : "Invalid request payload.",
    );
  }

  const rawName = typeof payload.name === "string" ? payload.name : "";
  const name = sanitizeDisplayName(rawName);

  if (Array.from(rawName).length > AUTH_DISPLAY_NAME_MAX_LENGTH) {
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
