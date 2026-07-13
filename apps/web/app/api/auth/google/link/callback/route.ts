import { NextResponse } from "next/server";

import { ensureAppUserRecord } from "@/lib/app-users/store";
import { exchangeGoogleCode, fetchGoogleUser } from "@/lib/auth/google";
import { upsertOAuthAuthMethod } from "@/lib/auth/methods";
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
import {
  appendReturnToSearchParams,
  AUTH_PROVIDER_ID_MAX_LENGTH,
  buildReturnToHref,
  isValidEmail,
  normalizeEmail,
} from "@/lib/auth/validation";

function redirectToReturn(
  origin: string,
  returnTo: string,
  profileAuth: string,
  request: Request,
  transactionId?: string | null,
) {
  const response = NextResponse.redirect(
    new URL(appendReturnToSearchParams(returnTo, { profileAuth }), origin),
    { status: 303 },
  );
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
  profileAuth: string,
  request: Request,
  transactionId: string,
) {
  try {
    await failOAuthTransaction(transactionId);
  } catch (failure) {
    console.error("Could not close failed Google link transaction.", {
      category: failure instanceof Error ? failure.name : "unknown",
    });
  }

  return redirectToReturn(origin, returnTo, profileAuth, request, transactionId);
}

export async function GET(request: Request) {
  const limited = await enforceAuthRateLimit(request, "oauth-callback-google");

  if (limited) {
    return limited;
  }

  const url = new URL(request.url);
  const requestOrigin = readRequestOrigin(request);
  const stateToken = url.searchParams.get("state");
  const transactionId = readOAuthStateTransactionId(stateToken, "google-link");

  if (!stateToken || !transactionId) {
    return redirectToReturn(
      requestOrigin,
      "/app",
      "google-link-failed",
      request,
      readOAuthStateTransactionIdForCleanup(stateToken),
    );
  }

  const nonce = readOAuthTransactionCookie(request, transactionId);
  let transaction: Awaited<ReturnType<typeof consumeOAuthTransaction>> = null;

  if (nonce) {
    try {
      transaction = await consumeOAuthTransaction({
        expectedFlow: "google-link",
        nonce,
        stateToken,
      });
    } catch (failure) {
      console.error("Google link state storage unavailable.", {
        category: failure instanceof Error ? failure.name : "unknown",
      });
      return Response.json(
        { error: "Google linking is temporarily unavailable. Try again." },
        { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } },
      );
    }
  }

  if (!transaction || !nonce) {
    return redirectToReturn(
      requestOrigin,
      "/app",
      "google-link-failed",
      request,
      transactionId,
    );
  }

  const stateOrigin = normalizeAuthOrigin(transaction.origin);

  if (!stateOrigin || stateOrigin !== requestOrigin) {
    return failAndRedirect(
      requestOrigin,
      transaction.returnTo,
      "google-link-failed",
      request,
      transactionId,
    );
  }

  const code = url.searchParams.get("code");

  if (url.searchParams.has("error") || !code || code.length > 2_048) {
    return failAndRedirect(
      stateOrigin,
      transaction.returnTo,
      "google-link-failed",
      request,
      transactionId,
    );
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
    return failAndRedirect(
      stateOrigin,
      transaction.returnTo,
      "google-link-failed",
      request,
      transactionId,
    );
  }

  try {
    const accessToken = await exchangeGoogleCode(code, transaction.pkceVerifier);
    const user = await fetchGoogleUser(accessToken);

    if (
      !user.email ||
      !user.email_verified ||
      !isValidEmail(user.email) ||
      !user.sub ||
      user.sub.length > AUTH_PROVIDER_ID_MAX_LENGTH
    ) {
      return failAndRedirect(
        stateOrigin,
        transaction.returnTo,
        "google-link-failed",
        request,
        transactionId,
      );
    }

    if (!(await finalizeOAuthTransaction(transactionId, nonce))) {
      return failAndRedirect(
        stateOrigin,
        transaction.returnTo,
        "google-link-failed",
        request,
        transactionId,
      );
    }

    await ensureAppUserRecord(session);
    await upsertOAuthAuthMethod({
      email: session.email,
      method: "google",
      providerId: user.sub,
      providerLabel: user.email,
    });

    return redirectToReturn(
      stateOrigin,
      transaction.returnTo,
      "google-linked",
      request,
      transactionId,
    );
  } catch (failure) {
    console.error("Google account linking failed.", {
      category: failure instanceof Error ? failure.name : "unknown",
    });
    const state =
      failure instanceof Error &&
      failure.message.includes("already linked to another Fugue account")
        ? "google-link-conflict"
        : "google-link-failed";
    return failAndRedirect(
      stateOrigin,
      transaction.returnTo,
      state,
      request,
      transactionId,
    );
  }
}
