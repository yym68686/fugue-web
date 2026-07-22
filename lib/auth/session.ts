import "server-only";

import { cookies } from "next/headers";

import { type AppUserRecord, getAppUserByEmail } from "@/lib/app-users/store";
import {
  logRejectedSession,
  readVersionedSessionToken,
  type VersionedSessionUser,
} from "@/lib/auth/session-claim";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";
import { evaluateSessionAuthorization } from "@/lib/auth/session-policy";
import { signToken } from "@/lib/auth/token";

export { logSessionRoleMismatch } from "@/lib/auth/session-claim";
export type {
  SessionAuthMethod,
  SessionUser,
  VersionedSessionUser,
} from "@/lib/auth/session-claim";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

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
