import { NextResponse } from "next/server";

import { ensureAppUserRecord } from "@/lib/app-users/store";
import { getCurrentSession } from "@/lib/auth/session";
import { normalizeAuthOrigin, readRequestOrigin } from "@/lib/auth/origin";
import { verifyToken } from "@/lib/auth/token";
import {
  buildReturnToHref,
  normalizeEmail,
  sanitizeReturnTo,
} from "@/lib/auth/validation";
import {
  saveGitHubConnection,
} from "@/lib/github/connection-store";
import {
  exchangeGitHubCode,
  fetchGitHubViewer,
} from "@/lib/github/oauth";

type StatePayload = {
  email: string;
  exp: number;
  iat: number;
  origin?: string;
  returnTo: string;
  type: "github-connect-state";
};

function redirectToReturn(origin: string, returnTo: string) {
  return NextResponse.redirect(new URL(returnTo, origin), {
    status: 303,
  });
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

  if (error || !code || !state || state.type !== "github-connect-state") {
    return redirectToReturn(stateOrigin, returnTo);
  }

  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.redirect(
      new URL(buildReturnToHref("/auth/sign-in", returnTo), stateOrigin),
      { status: 303 },
    );
  }

  if (normalizeEmail(session.email) !== normalizeEmail(state.email)) {
    return redirectToReturn(stateOrigin, returnTo);
  }

  try {
    await ensureAppUserRecord(session);

    const token = await exchangeGitHubCode(code);
    const viewer = await fetchGitHubViewer(token.accessToken);
    const scopes = Array.from(new Set([...token.scopes, ...viewer.scopes]));

    await saveGitHubConnection({
      accessToken: token.accessToken,
      avatarUrl: viewer.avatarUrl,
      email: session.email,
      githubUserId: viewer.id,
      login: viewer.login,
      name: viewer.name,
      scopes,
    });

    return redirectToReturn(stateOrigin, returnTo);
  } catch (error) {
    console.error("GitHub authorization callback failed.", error);
    return redirectToReturn(stateOrigin, returnTo);
  }
}
