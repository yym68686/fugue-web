import { NextResponse } from "next/server";

import { createGitHubAuthorizationUrl, isGitHubAuthConfigured } from "@/lib/auth/github";
import { readRequestOrigin } from "@/lib/auth/origin";
import { signToken } from "@/lib/auth/token";
import { parseAuthMode, sanitizeReturnTo } from "@/lib/auth/validation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = readRequestOrigin(request);
  const mode = parseAuthMode(url.searchParams.get("mode"));
  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));

  if (!isGitHubAuthConfigured()) {
    return NextResponse.redirect(new URL(`/auth/sign-in?provider=github&error=oauth_failed`, origin), {
      status: 303,
    });
  }

  const state = signToken(
    {
      origin,
      type: "github-oauth-state",
      mode,
      returnTo,
    },
    60 * 10,
  );

  return NextResponse.redirect(createGitHubAuthorizationUrl(state), { status: 303 });
}
