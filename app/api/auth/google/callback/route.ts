import { NextResponse } from "next/server";

import { ensureAppUserRecord } from "@/lib/app-users/store";
import {
  AUTH_ERROR_ACCOUNT_BLOCKED,
  AUTH_ERROR_ACCOUNT_DELETED,
  AUTH_ERROR_OAUTH_DENIED,
  AUTH_ERROR_OAUTH_FAILED,
  AUTH_ERROR_SESSION_OPEN_FAILED,
  type AuthErrorCode,
  buildSignInErrorUrl,
} from "@/lib/auth/errors";
import { buildSessionHandoffUrl } from "@/lib/auth/finalize";
import { fetchGoogleUser, exchangeGoogleCode } from "@/lib/auth/google";
import { normalizeAuthOrigin, readRequestOrigin } from "@/lib/auth/origin";
import { verifyToken } from "@/lib/auth/token";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";

type StatePayload = {
  exp: number;
  iat: number;
  mode: "signin" | "signup";
  origin?: string;
  returnTo: string;
  type: "oauth-state";
};

function redirectWithError(origin: string, error: AuthErrorCode) {
  return NextResponse.redirect(buildSignInErrorUrl(origin, error), { status: 303 });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestOrigin = readRequestOrigin(request);
  const error = url.searchParams.get("error");
  const stateToken = url.searchParams.get("state");
  const state = stateToken ? verifyToken<StatePayload>(stateToken) : null;
  const stateOrigin = normalizeAuthOrigin(state?.origin) ?? requestOrigin;

  if (error) {
    return redirectWithError(stateOrigin, AUTH_ERROR_OAUTH_DENIED);
  }

  const code = url.searchParams.get("code");

  if (!code || !stateToken) {
    return redirectWithError(requestOrigin, AUTH_ERROR_OAUTH_FAILED);
  }

  if (!state || state.type !== "oauth-state") {
    return redirectWithError(requestOrigin, AUTH_ERROR_OAUTH_FAILED);
  }

  try {
    const accessToken = await exchangeGoogleCode(code);
    const user = await fetchGoogleUser(accessToken);

    if (!user.email || !user.email_verified) {
      return redirectWithError(stateOrigin, AUTH_ERROR_OAUTH_FAILED);
    }

    const sessionUser = {
      email: user.email,
      name: user.name,
      picture: user.picture,
      provider: "google" as const,
      providerId: user.sub,
      verified: true,
    };

    try {
      await ensureAppUserRecord(sessionUser, {
        markSignedIn: true,
      });
      await ensureWorkspaceAccess(sessionUser);
    } catch (error) {
      if (error instanceof Error && error.message.includes("blocked")) {
        return redirectWithError(stateOrigin, AUTH_ERROR_ACCOUNT_BLOCKED);
      }

      if (error instanceof Error && error.message.includes("deleted")) {
        return redirectWithError(stateOrigin, AUTH_ERROR_ACCOUNT_DELETED);
      }

      console.error("Google sign-in provisioning failed.", error);
      return redirectWithError(stateOrigin, AUTH_ERROR_SESSION_OPEN_FAILED);
    }

    return NextResponse.redirect(
      buildSessionHandoffUrl(stateOrigin, sessionUser, state.returnTo),
      { status: 303 },
    );
  } catch (error) {
    console.error("Google OAuth callback failed.", error);
    return redirectWithError(stateOrigin, AUTH_ERROR_OAUTH_FAILED);
  }
}
