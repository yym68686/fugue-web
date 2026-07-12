import { timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  buildOriginUrl,
  normalizeAuthOrigin,
  readRequestOrigin,
} from "@/lib/auth/origin";
import { getCurrentSession } from "@/lib/auth/session";
import { verifyToken } from "@/lib/auth/token";
import {
  appendReturnToSearchParams,
  buildReturnToHref,
  normalizeEmail,
  sanitizeReturnTo,
} from "@/lib/auth/validation";
import {
  GITHUB_APP_INSTALL_STATE_COOKIE_NAME,
  recordGitHubAppInstallationCallback,
  readGitHubAppInstallationStatusForRepo,
} from "@/lib/github/app-installations";

type GitHubAppInstallStatePayload = {
  email: string;
  exp: number;
  githubRepo: string;
  iat: number;
  origin?: string;
  returnTo: string;
  type: "github-app-install-state";
};

function buildRedirectResponse(
  origin: string,
  returnTo: string,
  state: "github-app-install-failed" | "github-app-installed",
) {
  const nextPath = appendReturnToSearchParams(returnTo, {
    githubApp: state,
  });
  const response = NextResponse.redirect(buildOriginUrl(origin, nextPath), {
    status: 303,
  });

  response.headers.set("Cache-Control", "no-store");
  response.cookies.set({
    name: GITHUB_APP_INSTALL_STATE_COOKIE_NAME,
    value: "",
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
  });

  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestOrigin = readRequestOrigin(request);
  const cookieStore = await cookies();
  const queryState = url.searchParams.get("state") ?? "";
  const cookieState =
    cookieStore.get(GITHUB_APP_INSTALL_STATE_COOKIE_NAME)?.value ?? "";
  const matchingState =
    queryState.length > 0 &&
    queryState.length <= 4_096 &&
    queryState.length === cookieState.length &&
    timingSafeEqual(Buffer.from(queryState), Buffer.from(cookieState));
  const stateToken = matchingState ? queryState : "";
  const state = stateToken
    ? verifyToken<GitHubAppInstallStatePayload>(stateToken)
    : null;
  const stateOrigin = normalizeAuthOrigin(state?.origin);
  const returnTo = sanitizeReturnTo(state?.returnTo, requestOrigin);
  const installationId = url.searchParams.get("installation_id")?.trim() ?? "";

  if (
    !state ||
    state.type !== "github-app-install-state" ||
    stateOrigin !== requestOrigin
  ) {
    return buildRedirectResponse(requestOrigin, "/app", "github-app-install-failed");
  }

  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.redirect(
      buildOriginUrl(stateOrigin, buildReturnToHref("/auth/sign-in", returnTo)),
      { status: 303 },
    );
  }

  if (normalizeEmail(session.email) !== normalizeEmail(state.email)) {
    return buildRedirectResponse(stateOrigin, returnTo, "github-app-install-failed");
  }

  if (!installationId) {
    return buildRedirectResponse(stateOrigin, returnTo, "github-app-install-failed");
  }

  try {
    const installationStatus = await readGitHubAppInstallationStatusForRepo({
      githubRepo: state.githubRepo,
      userEmail: session.email,
    });

    if (!installationStatus.status.installed) {
      await recordGitHubAppInstallationCallback({
        githubInstallationId: installationId,
        githubRepo: state.githubRepo,
        userEmail: session.email,
      });
    }

    return buildRedirectResponse(stateOrigin, returnTo, "github-app-installed");
  } catch (error) {
    console.error("GitHub App installation callback failed.", {
      category: error instanceof Error ? error.name : "unknown",
    });
    return buildRedirectResponse(stateOrigin, returnTo, "github-app-install-failed");
  }
}
