import "server-only";

import { buildAppUrl } from "@/lib/auth/env";
import { parseGitHubScopes } from "@/lib/github/oauth";

type GitHubTokenPayload = {
  access_token?: string;
  error?: string;
  error_description?: string;
  scope?: string;
};

type GitHubViewerPayload = {
  avatar_url?: string;
  email?: string | null;
  id?: number;
  login?: string;
  name?: string;
};

type GitHubEmailPayload = {
  email?: string;
  primary?: boolean;
  verified?: boolean;
};

export type GitHubAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
};

export type GitHubAuthUser = {
  avatarUrl: string | null;
  email: string;
  id: string;
  login: string;
  name: string | null;
  scopes: string[];
};

function readOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getGitHubAuthConfig(): GitHubAuthConfig | null {
  const clientId = readOptionalEnv("GITHUB_AUTH_CLIENT_ID");
  const clientSecret = readOptionalEnv("GITHUB_AUTH_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri:
      readOptionalEnv("GITHUB_AUTH_REDIRECT_URI") ??
      buildAppUrl("/api/auth/github/callback").toString(),
    scope: readOptionalEnv("GITHUB_AUTH_SCOPE") ?? "read:user user:email",
  };
}

export function isGitHubAuthConfigured() {
  return Boolean(getGitHubAuthConfig());
}

export function createGitHubAuthorizationUrl(state: string) {
  const config = getGitHubAuthConfig();

  if (!config) {
    throw new Error("GitHub sign-in is not configured.");
  }

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);
  url.searchParams.set("allow_signup", "true");
  return url;
}

export async function exchangeGitHubCode(code: string) {
  const config = getGitHubAuthConfig();

  if (!config) {
    throw new Error("GitHub sign-in is not configured.");
  }

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to exchange GitHub authorization code.");
  }

  const payload = (await response.json()) as GitHubTokenPayload;

  if (!payload.access_token) {
    throw new Error(
      payload.error_description?.trim() ||
        payload.error?.trim() ||
        "GitHub token response did not include an access token.",
    );
  }

  return {
    accessToken: payload.access_token,
    scopes: parseGitHubScopes(payload.scope),
  };
}

async function fetchGitHubPrimaryEmail(accessToken: string) {
  const response = await fetch("https://api.github.com/user/emails", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch the verified GitHub email.");
  }

  const payload = (await response.json()) as GitHubEmailPayload[];
  const preferred = payload.find(
    (entry) => entry.primary && entry.verified && entry.email?.trim(),
  );
  const fallback = payload.find(
    (entry) => entry.verified && entry.email?.trim(),
  );

  return preferred?.email?.trim() || fallback?.email?.trim() || null;
}

export async function fetchGitHubUser(accessToken: string) {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch GitHub profile.");
  }

  const payload = (await response.json()) as GitHubViewerPayload;
  const login = payload.login?.trim();
  const id =
    typeof payload.id === "number" && Number.isFinite(payload.id)
      ? String(payload.id)
      : "";
  const email =
    payload.email?.trim() || (await fetchGitHubPrimaryEmail(accessToken));

  if (!login || !id || !email) {
    throw new Error("GitHub sign-in requires a verified primary email.");
  }

  return {
    avatarUrl: payload.avatar_url?.trim() || null,
    email,
    id,
    login,
    name: payload.name?.trim() || null,
    scopes: parseGitHubScopes(response.headers.get("x-oauth-scopes")),
  } satisfies GitHubAuthUser;
}
