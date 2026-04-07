import { getAuthEnv } from "@/lib/auth/env";

export type GoogleUser = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
};

function readOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function isGoogleAuthConfigured() {
  return Boolean(
    readOptionalEnv("GOOGLE_CLIENT_ID") &&
      readOptionalEnv("GOOGLE_CLIENT_SECRET") &&
      readOptionalEnv("GOOGLE_REDIRECT_URI"),
  );
}

export function createGoogleAuthorizationUrl(state: string) {
  const authEnv = getAuthEnv();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", authEnv.googleClientId);
  url.searchParams.set("redirect_uri", authEnv.googleRedirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeGoogleCode(code: string) {
  const authEnv = getAuthEnv();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: authEnv.googleClientId,
      client_secret: authEnv.googleClientSecret,
      redirect_uri: authEnv.googleRedirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to exchange Google authorization code");
  }

  const payload = (await response.json()) as { access_token?: string };

  if (!payload.access_token) {
    throw new Error("Google token response did not include an access token");
  }

  return payload.access_token;
}

export async function fetchGoogleUser(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Google profile");
  }

  return (await response.json()) as GoogleUser;
}
