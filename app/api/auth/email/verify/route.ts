import { NextResponse } from "next/server";

import { ensureAppUserRecord } from "@/lib/app-users/store";
import {
  AUTH_ERROR_ACCOUNT_BLOCKED,
  AUTH_ERROR_ACCOUNT_DELETED,
  AUTH_ERROR_INVALID_TOKEN,
  AUTH_ERROR_SESSION_OPEN_FAILED,
  type AuthErrorCode,
  buildSignInErrorUrl,
} from "@/lib/auth/errors";
import { buildSessionHandoffUrl } from "@/lib/auth/finalize";
import { consumeSessionHandoff } from "@/lib/auth/handoff-store";
import { syncAuthMethodOnSignIn } from "@/lib/auth/methods";
import { normalizeAuthOrigin, readRequestOrigin } from "@/lib/auth/origin";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { verifyToken } from "@/lib/auth/token";
import {
  isValidEmail,
  sanitizeDisplayName,
  sanitizeReturnTo,
} from "@/lib/auth/validation";
import { ensureWorkspaceAccessForSignIn } from "@/lib/workspace/bootstrap";

type EmailVerifyPayload = {
  email: string;
  exp: number;
  iat: number;
  jti: string;
  mode: "signin" | "signup";
  name?: string;
  origin?: string;
  returnTo?: string;
  type: "email-verify";
};

function redirectWithError(origin: string, error: AuthErrorCode) {
  return NextResponse.redirect(buildSignInErrorUrl(origin, error), {
    status: 303,
  });
}

export async function GET(request: Request) {
  const limited = await enforceAuthRateLimit(request, "email-verify");

  if (limited) {
    return limited;
  }

  const url = new URL(request.url);
  const requestOrigin = readRequestOrigin(request);
  const token = url.searchParams.get("token");

  if (!token || token.length > 4_096) {
    return redirectWithError(requestOrigin, AUTH_ERROR_INVALID_TOKEN);
  }

  const payload = verifyToken<EmailVerifyPayload>(token);
  const payloadOrigin = normalizeAuthOrigin(payload?.origin);

  if (
    !payload ||
    payload.type !== "email-verify" ||
    payloadOrigin !== requestOrigin ||
    !isValidEmail(payload.email) ||
    typeof payload.jti !== "string"
  ) {
    return redirectWithError(requestOrigin, AUTH_ERROR_INVALID_TOKEN);
  }

  try {
    if (!(await consumeSessionHandoff(payload.jti, payload.exp))) {
      return redirectWithError(requestOrigin, AUTH_ERROR_INVALID_TOKEN);
    }
  } catch (error) {
    console.error("Email verification token storage unavailable.", {
      category: error instanceof Error ? error.name : "unknown",
    });
    return Response.json(
      { error: "Email verification is temporarily unavailable. Try again." },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } },
    );
  }

  const sessionUser = {
    email: payload.email,
    name:
      typeof payload.name === "string" ? sanitizeDisplayName(payload.name) : undefined,
    provider: "email" as const,
    verified: true,
    authMethod: "email_link" as const,
  };

  let appUser: Awaited<ReturnType<typeof ensureAppUserRecord>>;

  try {
    appUser = await ensureAppUserRecord(sessionUser, {
      markSignedIn: true,
    });
    await syncAuthMethodOnSignIn({
      email: payload.email,
      method: "email_link",
    });
    await ensureWorkspaceAccessForSignIn(sessionUser);
  } catch (error) {
    if (error instanceof Error && error.message.includes("blocked")) {
      return redirectWithError(payloadOrigin, AUTH_ERROR_ACCOUNT_BLOCKED);
    }

    if (error instanceof Error && error.message.includes("deleted")) {
      return redirectWithError(payloadOrigin, AUTH_ERROR_ACCOUNT_DELETED);
    }

    console.error("Email sign-in provisioning failed.", {
      category: error instanceof Error ? error.name : "unknown",
    });
    return redirectWithError(payloadOrigin, AUTH_ERROR_SESSION_OPEN_FAILED);
  }

  const returnTo = sanitizeReturnTo(payload.returnTo, requestOrigin);

  return NextResponse.redirect(
    buildSessionHandoffUrl(
      payloadOrigin,
      { ...sessionUser, sessionVersion: appUser.sessionVersion },
      returnTo,
    ),
    {
      status: 303,
    },
  );
}
