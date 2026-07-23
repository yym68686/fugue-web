import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import {
  beginOAuthTransaction,
  buildOAuthTransactionCookie,
} from "@/lib/auth/oauth-transaction";
import { buildOriginUrl, isSecureRequest, readRequestOrigin } from "@/lib/auth/origin";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
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
  const limited = await enforceAuthRateLimit(request, "oauth-start-github");

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

  if (!isGitHubOAuthConfigured()) {
    return NextResponse.redirect(buildOriginUrl(origin, returnTo), {
      status: 303,
    });
  }

  let transaction: Awaited<ReturnType<typeof beginOAuthTransaction>>;

  try {
    transaction = await beginOAuthTransaction({
      flow: "github-connect",
      origin,
      returnTo,
      subjectEmail: normalizeEmail(session.email),
    });
  } catch (error) {
    console.error("Could not create GitHub connection transaction.", {
      category: error instanceof Error ? error.name : "unknown",
    });
    return Response.json(
      { error: "GitHub authorization is temporarily unavailable. Try again." },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } },
    );
  }

  const response = NextResponse.redirect(
    createGitHubAuthorizationUrl(transaction.state, transaction.codeChallenge),
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
