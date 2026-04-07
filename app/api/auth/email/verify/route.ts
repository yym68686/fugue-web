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
import { syncAuthMethodOnSignIn } from "@/lib/auth/methods";
import { normalizeAuthOrigin, readRequestOrigin } from "@/lib/auth/origin";
import { verifyToken } from "@/lib/auth/token";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";

type EmailVerifyPayload = {
  email: string;
  exp: number;
  iat: number;
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
  const url = new URL(request.url);
  const requestOrigin = readRequestOrigin(request);
  const token = url.searchParams.get("token");

  if (!token) {
    return redirectWithError(requestOrigin, AUTH_ERROR_INVALID_TOKEN);
  }

  const payload = verifyToken<EmailVerifyPayload>(token);
  const payloadOrigin = normalizeAuthOrigin(payload?.origin) ?? requestOrigin;

  if (!payload || payload.type !== "email-verify") {
    return redirectWithError(requestOrigin, AUTH_ERROR_INVALID_TOKEN);
  }

  const sessionUser = {
    email: payload.email,
    name: payload.name,
    provider: "email" as const,
    verified: true,
    authMethod: "email_link" as const,
  };

  try {
    await ensureAppUserRecord(sessionUser, {
      markSignedIn: true,
    });
    await syncAuthMethodOnSignIn({
      email: payload.email,
      method: "email_link",
    });
    await ensureWorkspaceAccess(sessionUser);
  } catch (error) {
    if (error instanceof Error && error.message.includes("blocked")) {
      return redirectWithError(payloadOrigin, AUTH_ERROR_ACCOUNT_BLOCKED);
    }

    if (error instanceof Error && error.message.includes("deleted")) {
      return redirectWithError(payloadOrigin, AUTH_ERROR_ACCOUNT_DELETED);
    }

    console.error("Email sign-in provisioning failed.", error);
    return redirectWithError(payloadOrigin, AUTH_ERROR_SESSION_OPEN_FAILED);
  }

  const returnTo = payload.returnTo ?? "/app";

  return NextResponse.redirect(buildSessionHandoffUrl(payloadOrigin, sessionUser, returnTo), {
    status: 303,
  });
}
