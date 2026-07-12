import { readBooleanEnv } from "@/lib/auth/validation";
import { readConfiguredCanonicalOrigin } from "@/lib/auth/origin";

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
  const explicit = readConfiguredCanonicalOrigin();

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
    if (process.env.NODE_ENV === "production" && explicit.length < 32) {
      throw new Error(
        "AUTH_SESSION_SECRET must contain at least 32 characters in production.",
      );
    }
    return explicit;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing required environment variable: AUTH_SESSION_SECRET");
  }

  return "fugue-development-session-secret-do-not-use-in-production";
}

export function getAuthSessionSecret() {
  return deriveSessionSecret();
}

export function getEmailVerificationRequired() {
  if (process.env.NODE_ENV === "production") {
    return true;
  }

  return readBooleanEnv(process.env.EMAIL_VERIFICATION_REQUIRED, true);
}

export function buildAppUrl(pathname: string) {
  return new URL(pathname, getAuthEnv().appBaseUrl);
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
    sessionSecret: getAuthSessionSecret(),
  };
}

export function validateAuthRuntimeConfiguration(): void {
  getAuthEnv();
}
