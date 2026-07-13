import { NextResponse } from "next/server";

import { ensureAppUserRecord } from "@/lib/app-users/store";
import {
  buildExpiredOAuthTransactionCookie,
  consumeOAuthTransaction,
  failOAuthTransaction,
  finalizeOAuthTransaction,
  readOAuthStateTransactionId,
  readOAuthStateTransactionIdForCleanup,
  readOAuthTransactionCookie,
} from "@/lib/auth/oauth-transaction";
import {
  isSecureRequest,
  normalizeAuthOrigin,
  readRequestOrigin,
} from "@/lib/auth/origin";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { getCurrentSession } from "@/lib/auth/session";
import { buildReturnToHref, normalizeEmail } from "@/lib/auth/validation";
import { saveGitHubConnection } from "@/lib/github/connection-store";
import { exchangeGitHubCode, fetchGitHubViewer } from "@/lib/github/oauth";

function redirectToReturn(
  origin: string,
  returnTo: string,
  request: Request,
  transactionId?: string | null,
) {
  const response = NextResponse.redirect(new URL(returnTo, origin), {
    status: 303,
  });
  response.headers.set("Cache-Control", "no-store");

  if (transactionId) {
    response.cookies.set(
      buildExpiredOAuthTransactionCookie(transactionId, isSecureRequest(request)),
    );
  }

  return response;
}

async function failAndRedirect(
  origin: string,
  returnTo: string,
  request: Request,
  transactionId: string,
) {
  try {
    await failOAuthTransaction(transactionId);
  } catch (failure) {
    console.error("Could not close failed GitHub connection transaction.", {
      category: failure instanceof Error ? failure.name : "unknown",
    });
  }

  return redirectToReturn(origin, returnTo, request, transactionId);
}

export async function GET(request: Request) {
  const limited = await enforceAuthRateLimit(request, "oauth-callback-github");

  if (limited) {
    return limited;
  }

  const url = new URL(request.url);
  const requestOrigin = readRequestOrigin(request);
  const stateToken = url.searchParams.get("state");
  const transactionId = readOAuthStateTransactionId(stateToken, "github-connect");

  if (!stateToken || !transactionId) {
    return redirectToReturn(
      requestOrigin,
      "/app",
      request,
      readOAuthStateTransactionIdForCleanup(stateToken),
    );
  }

  const nonce = readOAuthTransactionCookie(request, transactionId);
  let transaction: Awaited<ReturnType<typeof consumeOAuthTransaction>> = null;

  if (nonce) {
    try {
      transaction = await consumeOAuthTransaction({
        expectedFlow: "github-connect",
        nonce,
        stateToken,
      });
    } catch (failure) {
      console.error("GitHub connection state storage unavailable.", {
        category: failure instanceof Error ? failure.name : "unknown",
      });
      return Response.json(
        { error: "GitHub authorization is temporarily unavailable. Try again." },
        { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } },
      );
    }
  }

  if (!transaction || !nonce) {
    return redirectToReturn(requestOrigin, "/app", request, transactionId);
  }

  const stateOrigin = normalizeAuthOrigin(transaction.origin);

  if (!stateOrigin || stateOrigin !== requestOrigin) {
    return failAndRedirect(requestOrigin, transaction.returnTo, request, transactionId);
  }

  const code = url.searchParams.get("code");

  if (url.searchParams.has("error") || !code || code.length > 2_048) {
    return failAndRedirect(stateOrigin, transaction.returnTo, request, transactionId);
  }

  const session = await getCurrentSession();

  if (!session) {
    await failOAuthTransaction(transactionId).catch(() => undefined);
    const response = NextResponse.redirect(
      new URL(buildReturnToHref("/auth/sign-in", transaction.returnTo), stateOrigin),
      { status: 303 },
    );
    response.cookies.set(
      buildExpiredOAuthTransactionCookie(transactionId, isSecureRequest(request)),
    );
    return response;
  }

  if (
    !transaction.subjectEmail ||
    normalizeEmail(session.email) !== transaction.subjectEmail
  ) {
    return failAndRedirect(stateOrigin, transaction.returnTo, request, transactionId);
  }

  try {
    const token = await exchangeGitHubCode(code, transaction.pkceVerifier);
    const viewer = await fetchGitHubViewer(token.accessToken);

    if (!(await finalizeOAuthTransaction(transactionId, nonce))) {
      return failAndRedirect(stateOrigin, transaction.returnTo, request, transactionId);
    }

    await ensureAppUserRecord(session);
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

    return redirectToReturn(stateOrigin, transaction.returnTo, request, transactionId);
  } catch (failure) {
    console.error("GitHub authorization callback failed.", {
      category: failure instanceof Error ? failure.name : "unknown",
    });
    return failAndRedirect(stateOrigin, transaction.returnTo, request, transactionId);
  }
}
