import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { createGoogleAuthorizationUrl, isGoogleAuthConfigured } from "@/lib/auth/google";
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

  if (!isGoogleAuthConfigured()) {
    return NextResponse.redirect(
      new URL(
        appendReturnToSearchParams(returnTo, {
          profileAuth: "google-unavailable",
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
      type: "google-link-state",
    },
    60 * 10,
  );

  return NextResponse.redirect(createGoogleAuthorizationUrl(state), {
    status: 303,
  });
}
