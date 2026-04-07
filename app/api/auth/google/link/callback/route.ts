import { NextResponse } from "next/server";

import { ensureAppUserRecord } from "@/lib/app-users/store";
import { exchangeGoogleCode, fetchGoogleUser } from "@/lib/auth/google";
import { upsertOAuthAuthMethod } from "@/lib/auth/methods";
import { getCurrentSession } from "@/lib/auth/session";
import { normalizeAuthOrigin, readRequestOrigin } from "@/lib/auth/origin";
import { verifyToken } from "@/lib/auth/token";
import {
  appendReturnToSearchParams,
  buildReturnToHref,
  normalizeEmail,
  sanitizeReturnTo,
} from "@/lib/auth/validation";

type StatePayload = {
  email: string;
  exp: number;
  iat: number;
  origin?: string;
  returnTo: string;
  type: "google-link-state";
};

function redirectToReturn(origin: string, returnTo: string, profileAuth: string) {
  return NextResponse.redirect(
    new URL(
      appendReturnToSearchParams(returnTo, {
        profileAuth,
      }),
      origin,
    ),
    {
      status: 303,
    },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestOrigin = readRequestOrigin(request);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const stateToken = url.searchParams.get("state");
  const state = stateToken ? verifyToken<StatePayload>(stateToken) : null;
  const stateOrigin = normalizeAuthOrigin(state?.origin) ?? requestOrigin;
  const returnTo = sanitizeReturnTo(state?.returnTo);

  if (error || !code || !state || state.type !== "google-link-state") {
    return redirectToReturn(stateOrigin, returnTo, "google-link-failed");
  }

  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.redirect(
      new URL(buildReturnToHref("/auth/sign-in", returnTo), stateOrigin),
      { status: 303 },
    );
  }

  if (normalizeEmail(session.email) !== normalizeEmail(state.email)) {
    return redirectToReturn(stateOrigin, returnTo, "google-link-failed");
  }

  try {
    const accessToken = await exchangeGoogleCode(code);
    const user = await fetchGoogleUser(accessToken);

    if (!user.email || !user.email_verified) {
      return redirectToReturn(stateOrigin, returnTo, "google-link-failed");
    }

    await ensureAppUserRecord(session);
    await upsertOAuthAuthMethod({
      email: session.email,
      method: "google",
      providerId: user.sub,
      providerLabel: user.email,
    });

    return redirectToReturn(stateOrigin, returnTo, "google-linked");
  } catch (error) {
    console.error("Google account linking failed.", error);

    if (
      error instanceof Error &&
      error.message.includes("already linked to another Fugue account")
    ) {
      return redirectToReturn(stateOrigin, returnTo, "google-link-conflict");
    }

    return redirectToReturn(stateOrigin, returnTo, "google-link-failed");
  }
}
