import { createHash } from "node:crypto";

import { readPositiveSessionVersion } from "@/lib/auth/session-policy";
import { verifyToken } from "@/lib/auth/token";
import { isValidEmail, normalizeEmail } from "@/lib/auth/validation";

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

export function logRejectedSession(input: {
  email?: string;
  reason: string;
  token?: string;
}) {
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

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isSessionAuthMethod(value: unknown): value is SessionAuthMethod | undefined {
  return (
    value === undefined ||
    value === "email_link" ||
    value === "password" ||
    value === "google" ||
    value === "github"
  );
}

export function readVersionedSessionToken(token: string) {
  const payload = verifyToken<SessionTokenPayload>(token);
  const sessionVersion = readPositiveSessionVersion(payload?.sessionVersion);

  if (
    !payload ||
    payload.type !== "session" ||
    typeof payload.email !== "string" ||
    !isValidEmail(payload.email) ||
    typeof payload.verified !== "boolean" ||
    !isOptionalString(payload.name) ||
    !isOptionalString(payload.picture) ||
    !isOptionalString(payload.providerId) ||
    !isSessionAuthMethod(payload.authMethod) ||
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
