import { NextResponse } from "next/server";

import {
  createGoogleAuthorizationUrl,
  isGoogleAuthConfigured,
} from "@/lib/auth/google";
import {
  beginOAuthTransaction,
  buildOAuthTransactionCookie,
} from "@/lib/auth/oauth-transaction";
import {
  buildOriginUrl,
  isSecureRequest,
  readRequestOrigin,
} from "@/lib/auth/origin";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { getCurrentSession } from "@/lib/auth/session";
import {
  buildReturnToHref,
  normalizeEmail,
  sanitizeReturnTo,
} from "@/lib/auth/validation";

/**
 * Begin linking a Google identity to the currently signed-in account (as
 * opposed to /google/start which signs in / signs up). Mirrors the GitHub
 * connect flow: requires an active session and pins the transaction to the
 * session email via subjectEmail so the callback can only bind to this user.
 */
export async function GET(request: Request) {
  const limited = await enforceAuthRateLimit(request, "oauth-start-google");

  if (limited) {
    return limited;
  }

  const url = new URL(request.url);
  const origin = readRequestOrigin(request);
  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"), origin);
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.redirect(
      buildOriginUrl(origin, buildReturnToHref("/auth/sign-in", returnTo)),
      { status: 303 },
    );
  }

  if (!isGoogleAuthConfigured()) {
    return NextResponse.redirect(buildOriginUrl(origin, returnTo), {
      status: 303,
    });
  }

  let transaction: Awaited<ReturnType<typeof beginOAuthTransaction>>;

  try {
    transaction = await beginOAuthTransaction({
      flow: "google-link",
      origin,
      returnTo,
      subjectEmail: normalizeEmail(session.email),
    });
  } catch (error) {
    console.error("Could not create Google connection transaction.", {
      category: error instanceof Error ? error.name : "unknown",
    });
    return Response.json(
      { error: "Google authorization is temporarily unavailable. Try again." },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } },
    );
  }

  const response = NextResponse.redirect(
    createGoogleAuthorizationUrl(transaction.state, transaction.codeChallenge),
    { status: 303 },
  );
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(
    buildOAuthTransactionCookie(
      transaction.id,
      transaction.nonce,
      isSecureRequest(request),
    ),
  );
  return response;
}
