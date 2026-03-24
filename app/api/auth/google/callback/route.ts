import { NextResponse } from "next/server";

import { fetchGoogleUser, exchangeGoogleCode } from "@/lib/auth/google";
import { buildSessionCookie } from "@/lib/auth/session";
import { verifyToken } from "@/lib/auth/token";

type StatePayload = {
  exp: number;
  iat: number;
  mode: "signin" | "signup";
  returnTo: string;
  type: "oauth-state";
};

function redirectWithError(request: Request, error: string) {
  const destination = new URL(`/auth/sign-in?error=${error}`, request.url);
  return NextResponse.redirect(destination, { status: 303 });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");

  if (error) {
    return redirectWithError(request, "oauth_denied");
  }

  const code = url.searchParams.get("code");
  const stateToken = url.searchParams.get("state");

  if (!code || !stateToken) {
    return redirectWithError(request, "oauth_failed");
  }

  const state = verifyToken<StatePayload>(stateToken);

  if (!state || state.type !== "oauth-state") {
    return redirectWithError(request, "oauth_failed");
  }

  try {
    const accessToken = await exchangeGoogleCode(code);
    const user = await fetchGoogleUser(accessToken);

    if (!user.email || !user.email_verified) {
      return redirectWithError(request, "oauth_failed");
    }

    const response = NextResponse.redirect(new URL(state.returnTo, request.url), { status: 303 });
    response.cookies.set(
      buildSessionCookie({
        email: user.email,
        name: user.name,
        picture: user.picture,
        provider: "google",
        providerId: user.sub,
        verified: true,
      }),
    );

    return response;
  } catch {
    return redirectWithError(request, "oauth_failed");
  }
}
