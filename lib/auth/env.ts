import { createHash } from "node:crypto";

import { readBooleanEnv } from "@/lib/auth/validation";

export type AuthEnv = {
  appBaseUrl: string;
  emailVerificationRequired: boolean;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  resendApiKey: string;
  resendFromEmail: string;
  sessionSecret: string;
};

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function deriveBaseUrl() {
  const explicit =
    readOptionalEnv("APP_BASE_URL") ?? readOptionalEnv("NEXT_PUBLIC_APP_BASE_URL");

  if (explicit) {
    return explicit;
  }

  try {
    const redirect = new URL(readRequiredEnv("GOOGLE_REDIRECT_URI"));
    return redirect.origin;
  } catch {
    return "http://localhost:3000";
  }
}

function deriveSessionSecret() {
  const explicit = readOptionalEnv("AUTH_SESSION_SECRET");

  if (explicit) {
    return explicit;
  }

  const seed = [
    readRequiredEnv("GOOGLE_CLIENT_ID"),
    readRequiredEnv("GOOGLE_CLIENT_SECRET"),
    readRequiredEnv("RESEND_API_KEY"),
  ].join(":");

  return createHash("sha256").update(seed).digest("hex");
}

export function getEmailVerificationRequired() {
  return readBooleanEnv(process.env.EMAIL_VERIFICATION_REQUIRED, true);
}

export function getAuthEnv(): AuthEnv {
  return {
    appBaseUrl: deriveBaseUrl(),
    emailVerificationRequired: getEmailVerificationRequired(),
    googleClientId: readRequiredEnv("GOOGLE_CLIENT_ID"),
    googleClientSecret: readRequiredEnv("GOOGLE_CLIENT_SECRET"),
    googleRedirectUri: readRequiredEnv("GOOGLE_REDIRECT_URI"),
    resendApiKey: readRequiredEnv("RESEND_API_KEY"),
    resendFromEmail: readRequiredEnv("RESEND_FROM_EMAIL"),
    sessionSecret: deriveSessionSecret(),
  };
}
