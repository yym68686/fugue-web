import { NextResponse } from "next/server";

import {
  createGitHubAuthorizationUrl,
  isGitHubAuthConfigured,
} from "@/lib/auth/github";
import {
  beginOAuthTransaction,
  buildOAuthTransactionCookie,
} from "@/lib/auth/oauth-transaction";
import { isSecureRequest, readRequestOrigin } from "@/lib/auth/origin";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { parseAuthMode, sanitizeReturnTo } from "@/lib/auth/validation";

export async function GET(request: Request) {
  const limited = await enforceAuthRateLimit(request, "oauth-start-github");

  if (limited) {
    return limited;
  }

  const url = new URL(request.url);
  const origin = readRequestOrigin(request);
  const mode = parseAuthMode(url.searchParams.get("mode"));
  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"), origin);

  if (!isGitHubAuthConfigured()) {
    return NextResponse.redirect(
      new URL(`/auth/sign-in?provider=github&error=oauth_failed`, origin),
      {
        status: 303,
      },
    );
  }

  let transaction: Awaited<ReturnType<typeof beginOAuthTransaction>>;

  try {
    transaction = await beginOAuthTransaction({
      flow: "github-signin",
      origin,
      mode,
      returnTo,
    });
  } catch (error) {
    console.error("Could not create GitHub OAuth transaction.", {
      category: error instanceof Error ? error.name : "unknown",
    });
    return Response.json(
      { error: "GitHub sign-in is temporarily unavailable. Try again." },
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
