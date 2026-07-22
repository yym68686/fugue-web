import { randomUUID } from "node:crypto";

import { buildOriginUrl, normalizeAuthOrigin } from "@/lib/auth/origin";
import { readPositiveSessionVersion } from "@/lib/auth/session-policy";
import type { VersionedSessionUser } from "@/lib/auth/session";
import { signToken, verifyToken } from "@/lib/auth/token";
import { sanitizeReturnTo } from "@/lib/auth/validation";

const SESSION_HANDOFF_MAX_AGE_SECONDS = 60 * 5;

type SessionHandoffPayload = VersionedSessionUser & {
  exp: number;
  iat: number;
  jti: string;
  oauthTransactionId?: string;
  origin: string;
  returnTo: string;
  type: "session-handoff";
};

export function createSessionHandoffToken(
  origin: string,
  user: VersionedSessionUser,
  returnTo: string,
  oauthTransactionId?: string,
) {
  const normalizedOrigin = normalizeAuthOrigin(origin);

  if (!normalizedOrigin) {
    throw new Error("Invalid auth origin.");
  }

  return signToken(
    {
      ...user,
      jti: randomUUID(),
      origin: normalizedOrigin,
      type: "session-handoff",
      returnTo: sanitizeReturnTo(returnTo),
      ...(oauthTransactionId ? { oauthTransactionId } : {}),
    },
    SESSION_HANDOFF_MAX_AGE_SECONDS,
  );
}

export function verifySessionHandoffToken(token: string) {
  const payload = verifyToken<SessionHandoffPayload>(token);
  const sessionVersion = readPositiveSessionVersion(payload?.sessionVersion);

  if (!payload || payload.type !== "session-handoff" || !sessionVersion) {
    return null;
  }

  return {
    expiresAt: payload.exp,
    id: payload.jti,
    origin: normalizeAuthOrigin(payload.origin),
    oauthTransactionId: payload.oauthTransactionId,
    returnTo: sanitizeReturnTo(payload.returnTo),
    user: {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      provider: payload.provider,
      providerId: payload.providerId,
      verified: payload.verified,
      authMethod: payload.authMethod,
      sessionVersion,
    } satisfies VersionedSessionUser,
  };
}

export function buildSessionHandoffUrl(
  origin: string,
  user: VersionedSessionUser,
  returnTo: string,
  oauthTransactionId?: string,
) {
  const normalizedOrigin = normalizeAuthOrigin(origin);

  if (!normalizedOrigin) {
    throw new Error("Invalid auth origin.");
  }

  const sanitizedReturnTo = sanitizeReturnTo(returnTo);
  const url = buildOriginUrl(normalizedOrigin, "/auth/finalize");

  url.searchParams.set("returnTo", sanitizedReturnTo);
  // Keep the handoff token out of request logs and referrer headers.
  url.hash = createSessionHandoffToken(
    normalizedOrigin,
    user,
    sanitizedReturnTo,
    oauthTransactionId,
  );

  return url;
}
