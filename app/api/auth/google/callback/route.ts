import { NextResponse } from "next/server";

import { ensureAppUserRecord, getAppUserByEmail } from "@/lib/app-users/store";
import {
  AUTH_ERROR_ACCOUNT_BLOCKED,
  AUTH_ERROR_ACCOUNT_DELETED,
  AUTH_ERROR_OAUTH_DENIED,
  AUTH_ERROR_OAUTH_FAILED,
  AUTH_ERROR_SESSION_OPEN_FAILED,
  type AuthErrorCode,
  buildSignInErrorUrl,
} from "@/lib/auth/errors";
import { buildSessionHandoffUrl } from "@/lib/auth/finalize";
import { exchangeGoogleCode, fetchGoogleUser } from "@/lib/auth/google";
import {
  findUserEmailByAuthMethod,
  syncAuthMethodOnSignIn,
  upsertOAuthAuthMethod,
} from "@/lib/auth/methods";
import {
  buildExpiredOAuthTransactionCookie,
  consumeOAuthTransaction,
  failOAuthTransaction,
  finalizeOAuthTransaction,
  readOAuthStateFlow,
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
  type OAuthCallbackRejectionReason,
  logOAuthCallbackRejection,
} from "@/lib/auth/telemetry";
import {
  AUTH_PROVIDER_ID_MAX_LENGTH,
  buildReturnToHref,
  isValidEmail,
  normalizeEmail,
  sanitizeDisplayName,
  sanitizeExternalHttpUrl,
} from "@/lib/auth/validation";
import { ensureWorkspaceAccessForSignIn } from "@/lib/workspace/bootstrap";

function redirectWithError(
  origin: string,
  error: AuthErrorCode,
  request: Request,
  transactionId?: string | null,
) {
  const response = NextResponse.redirect(buildSignInErrorUrl(origin, error, "google"), {
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
  error: AuthErrorCode,
  request: Request,
  transactionId: string,
  reason: OAuthCallbackRejectionReason,
) {
  logOAuthCallbackRejection({ provider: "google", reason });
  try {
    await failOAuthTransaction(transactionId);
  } catch (failure) {
    console.error("Could not close failed Google OAuth transaction.", {
      category: failure instanceof Error ? failure.name : "unknown",
    });
  }

  return redirectWithError(origin, error, request, transactionId);
}

export async function GET(request: Request) {
  const limited = await enforceAuthRateLimit(request, "oauth-callback-google");

  if (limited) {
    return limited;
  }

  const url = new URL(request.url);

  // Google validates a single fixed redirect_uri, so both the sign-in and the
  // account-link flows land here. Branch on the flow declared in the signed
  // state before consuming the transaction against its expected flow.
  if (readOAuthStateFlow(url.searchParams.get("state")) === "google-link") {
    return handleGoogleLink(request, url);
  }

  const requestOrigin = readRequestOrigin(request);
  const stateToken = url.searchParams.get("state");
  const transactionId = readOAuthStateTransactionId(stateToken, "google-signin");

  if (!stateToken || !transactionId) {
    logOAuthCallbackRejection({ provider: "google", reason: "invalid-state" });
    return redirectWithError(
      requestOrigin,
      AUTH_ERROR_OAUTH_FAILED,
      request,
      readOAuthStateTransactionIdForCleanup(stateToken),
    );
  }

  const nonce = readOAuthTransactionCookie(request, transactionId);

  if (!nonce) {
    logOAuthCallbackRejection({
      provider: "google",
      reason: "missing-browser-nonce",
    });
    return redirectWithError(
      requestOrigin,
      AUTH_ERROR_OAUTH_FAILED,
      request,
      transactionId,
    );
  }

  let transaction: Awaited<ReturnType<typeof consumeOAuthTransaction>>;

  try {
    transaction = await consumeOAuthTransaction({
      expectedFlow: "google-signin",
      nonce,
      stateToken,
    });
  } catch (failure) {
    logOAuthCallbackRejection({
      outcome: "unavailable",
      provider: "google",
      reason: "transaction-store-unavailable",
    });
    console.error("Google OAuth state storage unavailable.", {
      category: failure instanceof Error ? failure.name : "unknown",
    });
    return Response.json(
      { error: "Google sign-in is temporarily unavailable. Try again." },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } },
    );
  }

  if (!transaction) {
    logOAuthCallbackRejection({
      provider: "google",
      reason: "state-not-consumable",
    });
    return redirectWithError(
      requestOrigin,
      AUTH_ERROR_OAUTH_FAILED,
      request,
      transactionId,
    );
  }

  const stateOrigin = normalizeAuthOrigin(transaction.origin);

  if (!stateOrigin || stateOrigin !== requestOrigin) {
    return failAndRedirect(
      requestOrigin,
      AUTH_ERROR_OAUTH_FAILED,
      request,
      transactionId,
      "origin-mismatch",
    );
  }

  const providerError = url.searchParams.get("error");
  const code = url.searchParams.get("code");

  if (providerError) {
    return failAndRedirect(
      stateOrigin,
      AUTH_ERROR_OAUTH_DENIED,
      request,
      transactionId,
      "provider-denied",
    );
  }

  if (!code || code.length > 2_048) {
    return failAndRedirect(
      stateOrigin,
      AUTH_ERROR_OAUTH_FAILED,
      request,
      transactionId,
      "invalid-code",
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
        AUTH_ERROR_OAUTH_FAILED,
        request,
        transactionId,
        "invalid-provider-profile",
      );
    }

    const linkedEmail = await findUserEmailByAuthMethod("google", user.sub);
    const resolvedEmail = linkedEmail ?? normalizeEmail(user.email);
    const existingUser = await getAppUserByEmail(resolvedEmail);
    const sessionUser = {
      email: resolvedEmail,
      name: sanitizeDisplayName(user.name ?? existingUser?.name ?? "") || undefined,
      picture:
        sanitizeExternalHttpUrl(user.picture ?? existingUser?.pictureUrl) ?? undefined,
      provider: "google" as const,
      providerId: user.sub,
      verified: true,
      authMethod: "google" as const,
    };
    let appUser: Awaited<ReturnType<typeof ensureAppUserRecord>>;

    try {
      appUser = await ensureAppUserRecord(sessionUser, { markSignedIn: true });
      await syncAuthMethodOnSignIn({
        email: resolvedEmail,
        method: "google",
        providerId: user.sub,
        providerLabel: user.email,
      });
      await ensureWorkspaceAccessForSignIn(sessionUser);
    } catch (failure) {
      if (failure instanceof Error && failure.message.includes("blocked")) {
        return failAndRedirect(
          stateOrigin,
          AUTH_ERROR_ACCOUNT_BLOCKED,
          request,
          transactionId,
          "account-blocked",
        );
      }

      if (failure instanceof Error && failure.message.includes("deleted")) {
        return failAndRedirect(
          stateOrigin,
          AUTH_ERROR_ACCOUNT_DELETED,
          request,
          transactionId,
          "account-deleted",
        );
      }

      console.error("Google sign-in provisioning failed.", {
        category: failure instanceof Error ? failure.name : "unknown",
      });
      return failAndRedirect(
        stateOrigin,
        AUTH_ERROR_SESSION_OPEN_FAILED,
        request,
        transactionId,
        "provisioning-failed",
      );
    }

    const response = NextResponse.redirect(
      buildSessionHandoffUrl(
        stateOrigin,
        { ...sessionUser, sessionVersion: appUser.sessionVersion },
        transaction.returnTo,
        transaction.id,
      ),
      { status: 303 },
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (failure) {
    console.error("Google OAuth callback failed.", {
      category: failure instanceof Error ? failure.name : "unknown",
    });
    return failAndRedirect(
      stateOrigin,
      AUTH_ERROR_OAUTH_FAILED,
      request,
      transactionId,
      "provider-exchange-failed",
    );
  }
}

function redirectToReturn(
  origin: string,
  returnTo: string,
  request: Request,
  transactionId?: string | null,
) {
  const response = NextResponse.redirect(new URL(returnTo, origin), { status: 303 });
  response.headers.set("Cache-Control", "no-store");

  if (transactionId) {
    response.cookies.set(
      buildExpiredOAuthTransactionCookie(transactionId, isSecureRequest(request)),
    );
  }

  return response;
}

async function failLinkAndRedirect(
  origin: string,
  returnTo: string,
  request: Request,
  transactionId: string,
) {
  try {
    await failOAuthTransaction(transactionId);
  } catch (failure) {
    console.error("Could not close failed Google connection transaction.", {
      category: failure instanceof Error ? failure.name : "unknown",
    });
  }

  return redirectToReturn(origin, returnTo, request, transactionId);
}

/**
 * Links a Google identity to the signed-in account. Reached only when the
 * signed state declares the `google-link` flow (started by
 * /api/auth/google/connect/start). Pins the binding to the session email via
 * subjectEmail and refuses to steal a Google identity already bound elsewhere.
 */
async function handleGoogleLink(request: Request, url: URL) {
  const requestOrigin = readRequestOrigin(request);
  const stateToken = url.searchParams.get("state");
  const transactionId = readOAuthStateTransactionId(stateToken, "google-link");

  if (!stateToken || !transactionId) {
    return redirectToReturn(
      requestOrigin,
      "/profile",
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
      console.error("Google connection state storage unavailable.", {
        category: failure instanceof Error ? failure.name : "unknown",
      });
      return Response.json(
        { error: "Google authorization is temporarily unavailable. Try again." },
        { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } },
      );
    }
  }

  if (!transaction || !nonce) {
    return redirectToReturn(requestOrigin, "/profile", request, transactionId);
  }

  const stateOrigin = normalizeAuthOrigin(transaction.origin);

  if (!stateOrigin || stateOrigin !== requestOrigin) {
    return failLinkAndRedirect(requestOrigin, transaction.returnTo, request, transactionId);
  }

  const code = url.searchParams.get("code");

  if (url.searchParams.has("error") || !code || code.length > 2_048) {
    return failLinkAndRedirect(stateOrigin, transaction.returnTo, request, transactionId);
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
    return failLinkAndRedirect(stateOrigin, transaction.returnTo, request, transactionId);
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
      return failLinkAndRedirect(
        stateOrigin,
        transaction.returnTo,
        request,
        transactionId,
      );
    }

    // Refuse to bind a Google identity that already belongs to another account.
    const ownerEmail = await findUserEmailByAuthMethod("google", user.sub);

    if (ownerEmail && ownerEmail !== normalizeEmail(session.email)) {
      return failLinkAndRedirect(
        stateOrigin,
        transaction.returnTo,
        request,
        transactionId,
      );
    }

    if (!(await finalizeOAuthTransaction(transactionId, nonce))) {
      return failLinkAndRedirect(
        stateOrigin,
        transaction.returnTo,
        request,
        transactionId,
      );
    }

    await upsertOAuthAuthMethod({
      email: session.email,
      method: "google",
      providerId: user.sub,
      providerLabel: user.email,
    });

    return redirectToReturn(stateOrigin, transaction.returnTo, request, transactionId);
  } catch (failure) {
    console.error("Google authorization callback failed.", {
      category: failure instanceof Error ? failure.name : "unknown",
    });
    return failLinkAndRedirect(stateOrigin, transaction.returnTo, request, transactionId);
  }
}
