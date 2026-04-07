import { cookies } from "next/headers";

import { signToken, verifyToken } from "@/lib/auth/token";

export const SESSION_COOKIE_NAME = "fugue_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type SessionAuthMethod =
  | "email_link"
  | "password"
  | "google"
  | "github";

export type SessionUser = {
  email: string;
  name?: string;
  picture?: string;
  provider: "google" | "email" | "github";
  providerId?: string;
  verified: boolean;
  authMethod?: SessionAuthMethod;
};

type SessionTokenPayload = SessionUser & {
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

export function createSessionToken(user: SessionUser) {
  return signToken(
    {
      type: "session",
      ...user,
    },
    SESSION_MAX_AGE_SECONDS,
  );
}

export function buildSessionCookie(user: SessionUser) {
  return {
    name: SESSION_COOKIE_NAME,
    value: createSessionToken(user),
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const payload = verifyToken<SessionTokenPayload>(token);

  if (!payload || payload.type !== "session") {
    return null;
  }

  return {
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    provider: payload.provider,
    providerId: payload.providerId,
    verified: payload.verified,
    authMethod: readSessionAuthMethod(payload.provider, payload.authMethod),
  } satisfies SessionUser;
}
