import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { createGitHubAuthorizationUrl, isGitHubAuthConfigured } from "@/lib/auth/github";
import { readRequestOrigin } from "@/lib/auth/origin";
import { signToken } from "@/lib/auth/token";
import {
  appendReturnToSearchParams,
  buildReturnToHref,
  normalizeEmail,
  sanitizeReturnTo,
} from "@/lib/auth/validation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = readRequestOrigin(request);
  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.redirect(
      new URL(buildReturnToHref("/auth/sign-in", returnTo), origin),
      { status: 303 },
    );
  }

  if (!isGitHubAuthConfigured()) {
    return NextResponse.redirect(
      new URL(
        appendReturnToSearchParams(returnTo, {
          profileAuth: "github-unavailable",
        }),
        origin,
      ),
      { status: 303 },
    );
  }

  const state = signToken(
    {
      email: normalizeEmail(session.email),
      origin,
      returnTo,
      type: "github-link-state",
    },
    60 * 10,
  );

  return NextResponse.redirect(createGitHubAuthorizationUrl(state), {
    status: 303,
  });
}
