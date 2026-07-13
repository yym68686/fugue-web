import "server-only";

import { createHash } from "node:crypto";

import { cookies } from "next/headers";

import { type AppUserRecord, getAppUserByEmail } from "@/lib/app-users/store";
import {
  evaluateSessionAuthorization,
  readPositiveSessionVersion,
} from "@/lib/auth/session-policy";
import { signToken, verifyToken } from "@/lib/auth/token";
import { normalizeEmail } from "@/lib/auth/validation";

export const SESSION_COOKIE_NAME = "fugue_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type SessionAuthMethod = "email_link" | "password" | "google" | "github";

export type SessionUser = {
  email: string;
  name?: string;
  picture?: string;
  provider: "google" | "email" | "github";
  providerId?: string;
  verified: boolean;
  authMethod?: SessionAuthMethod;
};

export type VersionedSessionUser = SessionUser & {
  sessionVersion: number;
};

type SessionTokenPayload = VersionedSessionUser & {
  type: "session";
  exp: number;
  iat: number;
};

export class SessionAuthorizationError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
    readonly reason: "blocked" | "deleted" | "missing-user" | "stale-version",
  ) {
    super(`${status} ${message}`);
    this.name = "SessionAuthorizationError";
  }
}

function readSessionAuthMethod(
  provider: SessionUser["provider"],
  authMethod: SessionAuthMethod | undefined,
) {
  if (
    authMethod === "email_link" ||
    authMethod === "password" ||
    authMethod === "google" ||
    authMethod === "github"
  ) {
    return authMethod;
  }

  if (provider === "google" || provider === "github") {
    return provider;
  }

  return "email_link";
}

function buildSessionSubjectFingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function logRejectedSession(input: { email?: string; reason: string; token?: string }) {
  console.warn(
    JSON.stringify({
      event: "fugue_web_session_rejection",
      reason: input.reason,
      subject: input.email
        ? buildSessionSubjectFingerprint(normalizeEmail(input.email))
        : input.token
          ? buildSessionSubjectFingerprint(input.token)
          : "unknown",
    }),
  );
}

export function logSessionRoleMismatch(email: string, requiredRole: string) {
  logRejectedSession({
    email,
    reason: `role-mismatch:${requiredRole.slice(0, 40)}`,
  });
}

function sessionUserFromPayload(payload: SessionTokenPayload) {
  return {
    email: normalizeEmail(payload.email),
    name: payload.name,
    picture: payload.picture,
    provider: payload.provider,
    providerId: payload.providerId,
    verified: payload.verified,
    authMethod: readSessionAuthMethod(payload.provider, payload.authMethod),
    sessionVersion: payload.sessionVersion,
  } satisfies VersionedSessionUser;
}

function readVersionedSessionToken(token: string) {
  const payload = verifyToken<SessionTokenPayload>(token);
  const sessionVersion = readPositiveSessionVersion(payload?.sessionVersion);

  if (
    !payload ||
    payload.type !== "session" ||
    !payload.email ||
    !sessionVersion ||
    (payload.provider !== "email" &&
      payload.provider !== "google" &&
      payload.provider !== "github")
  ) {
    logRejectedSession({
      reason:
        payload?.type === "session"
          ? "legacy-or-invalid-claims"
          : "invalid-signature-or-expired",
      token,
    });
    return null;
  }

  return sessionUserFromPayload({
    ...payload,
    sessionVersion,
  });
}

async function readCurrentSessionClaim() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return readVersionedSessionToken(token);
}

export function createSessionToken(user: VersionedSessionUser) {
  return signToken(
    {
      type: "session",
      ...user,
    },
    SESSION_MAX_AGE_SECONDS,
  );
}

export function buildSessionCookie(user: VersionedSessionUser) {
  return {
    name: SESSION_COOKIE_NAME,
    value: createSessionToken(user),
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export async function getCurrentActiveSessionUser() {
  const session = await readCurrentSessionClaim();

  if (!session) {
    return null;
  }

  const user = await getAppUserByEmail(session.email);
  const rejection = evaluateSessionAuthorization({
    claimedVersion: session.sessionVersion,
    storedVersion: user?.sessionVersion,
    userStatus: user?.status,
  });

  if (rejection) {
    logRejectedSession({ email: session.email, reason: rejection.reason });
    throw new SessionAuthorizationError(
      rejection.status,
      rejection.message,
      rejection.reason,
    );
  }

  // The policy above rejects the missing-user case.
  if (!user) {
    throw new Error("500 Session authorization invariant failed.");
  }

  return {
    session,
    user,
  } satisfies {
    session: VersionedSessionUser;
    user: AppUserRecord;
  };
}

export async function getCurrentSession() {
  try {
    const current = await getCurrentActiveSessionUser();
    return current?.session ?? null;
  } catch (error) {
    if (error instanceof SessionAuthorizationError) {
      return null;
    }

    throw error;
  }
}
