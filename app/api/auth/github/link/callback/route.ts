import { NextResponse } from "next/server";

import { ensureAppUserRecord } from "@/lib/app-users/store";
import { exchangeGitHubCode, fetchGitHubUser } from "@/lib/auth/github";
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
  type: "github-link-state";
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

  if (error || !code || !state || state.type !== "github-link-state") {
    return redirectToReturn(stateOrigin, returnTo, "github-link-failed");
  }

  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.redirect(
      new URL(buildReturnToHref("/auth/sign-in", returnTo), stateOrigin),
      { status: 303 },
    );
  }

  if (normalizeEmail(session.email) !== normalizeEmail(state.email)) {
    return redirectToReturn(stateOrigin, returnTo, "github-link-failed");
  }

  try {
    const token = await exchangeGitHubCode(code);
    const user = await fetchGitHubUser(token.accessToken);

    await ensureAppUserRecord(session);
    await upsertOAuthAuthMethod({
      email: session.email,
      method: "github",
      providerId: user.id,
      providerLabel: `@${user.login}`,
    });

    return redirectToReturn(stateOrigin, returnTo, "github-linked");
  } catch (error) {
    console.error("GitHub account linking failed.", error);

    if (
      error instanceof Error &&
      error.message.includes("already linked to another Fugue account")
    ) {
      return redirectToReturn(stateOrigin, returnTo, "github-link-conflict");
    }

    return redirectToReturn(stateOrigin, returnTo, "github-link-failed");
  }
}
