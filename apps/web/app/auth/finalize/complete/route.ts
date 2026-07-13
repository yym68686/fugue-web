import { NextResponse } from "next/server";

import { AUTH_ERROR_HANDOFF_FAILED, buildSignInErrorUrl } from "@/lib/auth/errors";
import { verifySessionHandoffToken } from "@/lib/auth/finalize";
import { consumeSessionHandoff } from "@/lib/auth/handoff-store";
import {
  buildExpiredOAuthTransactionCookie,
  consumeOAuthSessionHandoff,
  readOAuthTransactionCookie,
} from "@/lib/auth/oauth-transaction";
import { buildOriginUrl, isSecureRequest, readRequestOrigin } from "@/lib/auth/origin";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import {
  AuthRequestTooLargeError,
  readLimitedUrlEncodedForm,
} from "@/lib/auth/request";
import { buildSessionCookie } from "@/lib/auth/session";

function redirectWithError(
  origin: string,
  request: Request,
  transactionId?: string | null,
) {
  const response = NextResponse.redirect(
    buildSignInErrorUrl(origin, AUTH_ERROR_HANDOFF_FAILED),
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

export async function POST(request: Request) {
  const limited = await enforceAuthRateLimit(request, "finalize");

  if (limited) {
    return limited;
  }

  const requestOrigin = readRequestOrigin(request);
  const secure = isSecureRequest(request);
  let formData: URLSearchParams;

  try {
    formData = await readLimitedUrlEncodedForm(request, 8 * 1_024);
  } catch (error) {
    if (error instanceof AuthRequestTooLargeError) {
      return Response.json(
        { error: "Session handoff payload is too large." },
        { status: 413, headers: { "Cache-Control": "no-store" } },
      );
    }

    return redirectWithError(requestOrigin, request);
  }

  const rawToken = formData.get("token");
  const token = rawToken?.trim() ?? "";

  if (!token || token.length > 4_096) {
    return redirectWithError(requestOrigin, request);
  }

  const handoff = verifySessionHandoffToken(token);

  if (!handoff || !handoff.origin) {
    return redirectWithError(requestOrigin, request);
  }

  if (handoff.origin !== requestOrigin) {
    return redirectWithError(requestOrigin, request, handoff.oauthTransactionId);
  }

  let consumed = false;

  try {
    if (handoff.oauthTransactionId) {
      const nonce = readOAuthTransactionCookie(request, handoff.oauthTransactionId);
      consumed = Boolean(
        nonce &&
          (await consumeOAuthSessionHandoff({
            expiresAt: handoff.expiresAt,
            handoffId: handoff.id,
            nonce,
            transactionId: handoff.oauthTransactionId,
          })),
      );
    } else {
      consumed = await consumeSessionHandoff(handoff.id, handoff.expiresAt);
    }
  } catch (error) {
    console.error("Session handoff storage unavailable.", {
      category: error instanceof Error ? error.name : "unknown",
    });
    return Response.json(
      { error: "Session verification is temporarily unavailable. Try again." },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } },
    );
  }

  if (!consumed) {
    return redirectWithError(requestOrigin, request, handoff.oauthTransactionId);
  }

  const response = NextResponse.redirect(
    buildOriginUrl(requestOrigin, handoff.returnTo),
    { status: 303 },
  );
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set({
    ...buildSessionCookie(handoff.user),
    secure,
  });

  if (handoff.oauthTransactionId) {
    response.cookies.set(
      buildExpiredOAuthTransactionCookie(handoff.oauthTransactionId, secure),
    );
  }

  return response;
}
