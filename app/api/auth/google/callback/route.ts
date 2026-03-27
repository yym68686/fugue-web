import { NextResponse } from "next/server";

import { ensureAppUserRecord } from "@/lib/app-users/store";
import { buildSessionHandoffUrl } from "@/lib/auth/finalize";
import { fetchGoogleUser, exchangeGoogleCode } from "@/lib/auth/google";
import { buildOriginUrl, normalizeAuthOrigin, readRequestOrigin } from "@/lib/auth/origin";
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

function redirectWithError(origin: string, error: string) {
  const destination = buildOriginUrl(origin, `/auth/sign-in?error=${error}`);
  return NextResponse.redirect(destination, { status: 303 });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestOrigin = readRequestOrigin(request);
  const error = url.searchParams.get("error");
  const stateToken = url.searchParams.get("state");
  const state = stateToken ? verifyToken<StatePayload>(stateToken) : null;
  const stateOrigin = normalizeAuthOrigin(state?.origin) ?? requestOrigin;

  if (error) {
    return redirectWithError(stateOrigin, "oauth_denied");
  }

  const code = url.searchParams.get("code");

  if (!code || !stateToken) {
    return redirectWithError(requestOrigin, "oauth_failed");
  }

  if (!state || state.type !== "oauth-state") {
    return redirectWithError(requestOrigin, "oauth_failed");
  }

  try {
    const accessToken = await exchangeGoogleCode(code);
    const user = await fetchGoogleUser(accessToken);

    if (!user.email || !user.email_verified) {
      return redirectWithError(stateOrigin, "oauth_failed");
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
        return redirectWithError(stateOrigin, "account-blocked");
      }

      if (error instanceof Error && error.message.includes("deleted")) {
        return redirectWithError(stateOrigin, "account-deleted");
      }

      console.error("Google sign-in provisioning failed.", error);
      return redirectWithError(stateOrigin, "oauth_failed");
    }

    return NextResponse.redirect(
      buildSessionHandoffUrl(stateOrigin, sessionUser, state.returnTo),
      { status: 303 },
    );
  } catch (error) {
    console.error("Google OAuth callback failed.", error);
    return redirectWithError(stateOrigin, "oauth_failed");
  }
}
