import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { buildOriginUrl, readRequestOrigin } from "@/lib/auth/origin";
import { signToken } from "@/lib/auth/token";
import {
  buildReturnToHref,
  normalizeEmail,
  sanitizeReturnTo,
} from "@/lib/auth/validation";
import {
  createGitHubAuthorizationUrl,
  isGitHubOAuthConfigured,
} from "@/lib/github/oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = readRequestOrigin(request);
  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.redirect(
      buildOriginUrl(origin, buildReturnToHref("/auth/sign-in", returnTo)),
      { status: 303 },
    );
  }

  if (!isGitHubOAuthConfigured()) {
    return NextResponse.redirect(buildOriginUrl(origin, returnTo), {
      status: 303,
    });
  }

  const state = signToken(
    {
      email: normalizeEmail(session.email),
      origin,
      returnTo,
      type: "github-connect-state",
    },
    60 * 10,
  );

  return NextResponse.redirect(createGitHubAuthorizationUrl(state), {
    status: 303,
  });
}
