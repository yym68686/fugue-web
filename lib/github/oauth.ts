import "server-only";

import { buildAppUrl } from "@/lib/auth/env";

type GitHubTokenPayload = {
  access_token?: string;
  error?: string;
  error_description?: string;
  scope?: string;
  token_type?: string;
};

type GitHubViewerPayload = {
  avatar_url?: string;
  id?: number;
  login?: string;
  name?: string;
};

export type GitHubOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
};

export type GitHubTokenExchangeResult = {
  accessToken: string;
  scopes: string[];
};

export type GitHubViewer = {
  avatarUrl: string | null;
  id: string;
  login: string;
  name: string | null;
  scopes: string[];
};

function readOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function parseGitHubScopes(value?: string | null) {
  if (!value?.trim()) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(/[,\s]+/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

export function getGitHubOAuthConfig(): GitHubOAuthConfig | null {
  const clientId = readOptionalEnv("GITHUB_OAUTH_CLIENT_ID");
  const clientSecret = readOptionalEnv("GITHUB_OAUTH_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri:
      readOptionalEnv("GITHUB_OAUTH_REDIRECT_URI") ??
      buildAppUrl("/api/auth/github/connect/callback").toString(),
    scope: readOptionalEnv("GITHUB_OAUTH_SCOPE") ?? "repo",
  };
}

export function isGitHubOAuthConfigured() {
  return Boolean(getGitHubOAuthConfig());
}

export function createGitHubAuthorizationUrl(state: string) {
  const config = getGitHubOAuthConfig();

  if (!config) {
    throw new Error("GitHub OAuth is not configured.");
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
  const config = getGitHubOAuthConfig();

  if (!config) {
    throw new Error("GitHub OAuth is not configured.");
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
  } satisfies GitHubTokenExchangeResult;
}

export async function fetchGitHubViewer(accessToken: string) {
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

  if (!login || !id) {
    throw new Error("GitHub profile is missing the account identity.");
  }

  return {
    avatarUrl: payload.avatar_url?.trim() || null,
    id,
    login,
    name: payload.name?.trim() || null,
    scopes: parseGitHubScopes(response.headers.get("x-oauth-scopes")),
  } satisfies GitHubViewer;
}
