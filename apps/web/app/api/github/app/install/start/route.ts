import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { buildOriginUrl, isSecureRequest, readRequestOrigin } from "@/lib/auth/origin";
import { buildReturnToHref, sanitizeReturnTo } from "@/lib/auth/validation";
import {
  GITHUB_APP_INSTALL_STATE_COOKIE_NAME,
  readGitHubAppInstallUrl,
} from "@/lib/github/app-installations";
import { normalizeGitHubRepositoryInput } from "@/lib/github/project-image-tracking";
import { signToken } from "@/lib/auth/token";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = readRequestOrigin(request);
  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"), origin);
  const githubRepoInput = url.searchParams.get("githubRepo") ?? "";
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.redirect(
      buildOriginUrl(origin, buildReturnToHref("/auth/sign-in", returnTo)),
      { status: 303 },
    );
  }

  if (!githubRepoInput.trim()) {
    return NextResponse.redirect(buildOriginUrl(origin, returnTo), {
      status: 303,
    });
  }

  let githubRepo: string;

  try {
    githubRepo = normalizeGitHubRepositoryInput(githubRepoInput);
  } catch {
    return NextResponse.redirect(buildOriginUrl(origin, returnTo), {
      status: 303,
    });
  }

  const state = signToken(
    {
      email: session.email,
      githubRepo,
      origin,
      returnTo,
      type: "github-app-install-state",
    },
    60 * 15,
  );

  const installUrl = new URL(readGitHubAppInstallUrl());
  installUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(installUrl, { status: 303 });
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set({
    name: GITHUB_APP_INSTALL_STATE_COOKIE_NAME,
    value: state,
    httpOnly: true,
    maxAge: 60 * 15,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(request),
  });

  return response;
}
