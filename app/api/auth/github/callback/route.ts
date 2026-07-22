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
import { exchangeGitHubCode, fetchGitHubUser } from "@/lib/auth/github";
import { findUserEmailByAuthMethod, syncAuthMethodOnSignIn } from "@/lib/auth/methods";
import {
  buildExpiredOAuthTransactionCookie,
  consumeOAuthTransaction,
  failOAuthTransaction,
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
import {
  type OAuthCallbackRejectionReason,
  logOAuthCallbackRejection,
} from "@/lib/auth/telemetry";
import {
  AUTH_PROVIDER_ID_MAX_LENGTH,
  isValidEmail,
  normalizeEmail,
  sanitizeDisplayName,
  sanitizeExternalHttpUrl,
} from "@/lib/auth/validation";
// [STEP2] provisioning disabled for step 1 (auth-only): restore with lib/workspace/bootstrap
// import { ensureWorkspaceAccessForSignIn } from "@/lib/workspace/bootstrap";

function redirectWithError(
  origin: string,
  error: AuthErrorCode,
  request: Request,
  transactionId?: string | null,
) {
  const response = NextResponse.redirect(buildSignInErrorUrl(origin, error, "github"), {
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
  logOAuthCallbackRejection({ provider: "github", reason });
  try {
    await failOAuthTransaction(transactionId);
  } catch (failure) {
    console.error("Could not close failed GitHub OAuth transaction.", {
      category: failure instanceof Error ? failure.name : "unknown",
    });
  }

  return redirectWithError(origin, error, request, transactionId);
}

export async function GET(request: Request) {
  const limited = await enforceAuthRateLimit(request, "oauth-callback-github");

  if (limited) {
    return limited;
  }

  const url = new URL(request.url);
  const requestOrigin = readRequestOrigin(request);
  const stateToken = url.searchParams.get("state");
  const transactionId = readOAuthStateTransactionId(stateToken, "github-signin");

  if (!stateToken || !transactionId) {
    logOAuthCallbackRejection({ provider: "github", reason: "invalid-state" });
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
      provider: "github",
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
      expectedFlow: "github-signin",
      nonce,
      stateToken,
    });
  } catch (failure) {
    logOAuthCallbackRejection({
      outcome: "unavailable",
      provider: "github",
      reason: "transaction-store-unavailable",
    });
    console.error("GitHub OAuth state storage unavailable.", {
      category: failure instanceof Error ? failure.name : "unknown",
    });
    return Response.json(
      { error: "GitHub sign-in is temporarily unavailable. Try again." },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } },
    );
  }

  if (!transaction) {
    logOAuthCallbackRejection({
      provider: "github",
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
    const token = await exchangeGitHubCode(code, transaction.pkceVerifier);
    const user = await fetchGitHubUser(token.accessToken);

    if (
      !isValidEmail(user.email) ||
      !user.id ||
      user.id.length > AUTH_PROVIDER_ID_MAX_LENGTH
    ) {
      return failAndRedirect(
        stateOrigin,
        AUTH_ERROR_OAUTH_FAILED,
        request,
        transactionId,
        "invalid-provider-profile",
      );
    }

    const linkedEmail = await findUserEmailByAuthMethod("github", user.id);
    const resolvedEmail = linkedEmail ?? normalizeEmail(user.email);
    const existingUser = await getAppUserByEmail(resolvedEmail);
    const sessionUser = {
      email: resolvedEmail,
      name: sanitizeDisplayName(user.name ?? existingUser?.name ?? "") || undefined,
      picture:
        sanitizeExternalHttpUrl(user.avatarUrl ?? existingUser?.pictureUrl) ??
        undefined,
      provider: "github" as const,
      providerId: user.id,
      verified: true,
      authMethod: "github" as const,
    };
    let appUser: Awaited<ReturnType<typeof ensureAppUserRecord>>;

    try {
      appUser = await ensureAppUserRecord(sessionUser, { markSignedIn: true });
      await syncAuthMethodOnSignIn({
        email: resolvedEmail,
        method: "github",
        providerId: user.id,
        providerLabel: `@${user.login}`,
      });
      // [STEP2] await ensureWorkspaceAccessForSignIn(sessionUser);
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

      console.error("GitHub sign-in provisioning failed.", {
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
    console.error("GitHub OAuth callback failed.", {
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
