import { buildOriginUrl, normalizeAuthOrigin } from "@/lib/auth/origin";
import type { SessionUser } from "@/lib/auth/session";
import { signToken, verifyToken } from "@/lib/auth/token";
import { sanitizeReturnTo } from "@/lib/auth/validation";

const SESSION_HANDOFF_MAX_AGE_SECONDS = 60 * 5;

type SessionHandoffPayload = SessionUser & {
  exp: number;
  iat: number;
  origin: string;
  returnTo: string;
  type: "session-handoff";
};

export function createSessionHandoffToken(
  origin: string,
  user: SessionUser,
  returnTo: string,
) {
  const normalizedOrigin = normalizeAuthOrigin(origin);

  if (!normalizedOrigin) {
    throw new Error("Invalid auth origin.");
  }

  return signToken(
    {
      origin: normalizedOrigin,
      type: "session-handoff",
      returnTo: sanitizeReturnTo(returnTo),
      ...user,
    },
    SESSION_HANDOFF_MAX_AGE_SECONDS,
  );
}

export function verifySessionHandoffToken(token: string) {
  const payload = verifyToken<SessionHandoffPayload>(token);

  if (!payload || payload.type !== "session-handoff") {
    return null;
  }

  return {
    origin: normalizeAuthOrigin(payload.origin),
    returnTo: sanitizeReturnTo(payload.returnTo),
    user: {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      provider: payload.provider,
      providerId: payload.providerId,
      verified: payload.verified,
    } satisfies SessionUser,
  };
}

export function buildSessionHandoffUrl(origin: string, user: SessionUser, returnTo: string) {
  const normalizedOrigin = normalizeAuthOrigin(origin);

  if (!normalizedOrigin) {
    throw new Error("Invalid auth origin.");
  }

  const sanitizedReturnTo = sanitizeReturnTo(returnTo);
  const url = buildOriginUrl(normalizedOrigin, "/auth/finalize");

  url.searchParams.set("returnTo", sanitizedReturnTo);
  // Keep the handoff token out of request logs and referrer headers.
  url.hash = createSessionHandoffToken(normalizedOrigin, user, sanitizedReturnTo);

  return url;
}
