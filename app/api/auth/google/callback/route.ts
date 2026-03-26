import { NextResponse } from "next/server";

import { ensureAppUserRecord } from "@/lib/app-users/store";
import { fetchGoogleUser, exchangeGoogleCode } from "@/lib/auth/google";
import { buildAppUrl } from "@/lib/auth/env";
import { buildSessionCookie } from "@/lib/auth/session";
import { verifyToken } from "@/lib/auth/token";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";

type StatePayload = {
  exp: number;
  iat: number;
  mode: "signin" | "signup";
  returnTo: string;
  type: "oauth-state";
};

function redirectWithError(error: string) {
  const destination = buildAppUrl(`/auth/sign-in?error=${error}`);
  return NextResponse.redirect(destination, { status: 303 });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");

  if (error) {
    return redirectWithError("oauth_denied");
  }

  const code = url.searchParams.get("code");
  const stateToken = url.searchParams.get("state");

  if (!code || !stateToken) {
    return redirectWithError("oauth_failed");
  }

  const state = verifyToken<StatePayload>(stateToken);

  if (!state || state.type !== "oauth-state") {
    return redirectWithError("oauth_failed");
  }

  try {
    const accessToken = await exchangeGoogleCode(code);
    const user = await fetchGoogleUser(accessToken);

    if (!user.email || !user.email_verified) {
      return redirectWithError("oauth_failed");
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
        return redirectWithError("account-blocked");
      }

      if (error instanceof Error && error.message.includes("deleted")) {
        return redirectWithError("account-deleted");
      }

      console.error("Google sign-in provisioning failed.", error);
      return redirectWithError("oauth_failed");
    }

    const response = NextResponse.redirect(buildAppUrl(state.returnTo), { status: 303 });
    response.cookies.set(
      buildSessionCookie(sessionUser),
    );

    return response;
  } catch (error) {
    console.error("Google OAuth callback failed.", error);
    return redirectWithError("oauth_failed");
  }
}
