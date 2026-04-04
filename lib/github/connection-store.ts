import "server-only";

import type { GitHubRepoVisibility } from "@/lib/github/repository";
import { normalizeEmail } from "@/lib/auth/validation";
import { ensureDbSchema } from "@/lib/db/schema";
import { queryDb } from "@/lib/db/pool";
import { sealText, unsealText } from "@/lib/security/seal";

type GitHubConnectionRow = {
  access_token_sealed: string;
  created_at: Date | string;
  github_avatar_url: string | null;
  github_login: string;
  github_name: string | null;
  github_scopes: unknown;
  github_user_id: string;
  updated_at: Date | string;
  user_email: string;
};

export type GitHubConnectionRecord = {
  accessToken: string;
  avatarUrl: string | null;
  createdAt: string;
  email: string;
  githubUserId: string;
  login: string;
  name: string | null;
  scopes: string[];
  updatedAt: string;
};

export type GitHubConnectionSnapshot = Omit<
  GitHubConnectionRecord,
  "accessToken"
>;

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readTimestamp(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function readStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter(
      (entry): entry is string =>
        typeof entry === "string" && entry.trim().length > 0,
    );
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return readStringArray(parsed);
    } catch {
      return [];
    }
  }

  return [];
}

function recordFromRow(row: GitHubConnectionRow): GitHubConnectionRecord {
  return {
    accessToken: unsealText(row.access_token_sealed),
    avatarUrl: readOptionalString(row.github_avatar_url),
    createdAt: readTimestamp(row.created_at),
    email: normalizeEmail(row.user_email),
    githubUserId: row.github_user_id,
    login: row.github_login,
    name: readOptionalString(row.github_name),
    scopes: readStringArray(row.github_scopes),
    updatedAt: readTimestamp(row.updated_at),
  };
}

async function getGitHubConnectionRowByEmail(email: string) {
  await ensureDbSchema();

  const result = await queryDb<GitHubConnectionRow>(
    `
      SELECT
        user_email,
        github_user_id,
        github_login,
        github_name,
        github_avatar_url,
        github_scopes,
        access_token_sealed,
        created_at,
        updated_at
      FROM app_github_connections
      WHERE user_email = $1
      LIMIT 1
    `,
    [normalizeEmail(email)],
  );

  return result.rows[0] ?? null;
}

export async function getGitHubConnectionByEmail(email: string) {
  const row = await getGitHubConnectionRowByEmail(email);

  if (!row) {
    return null;
  }

  try {
    return recordFromRow(row);
  } catch {
    return null;
  }
}

export async function getGitHubConnectionSnapshotByEmail(email: string) {
  const record = await getGitHubConnectionByEmail(email);

  if (!record) {
    return null;
  }

  const { accessToken: _accessToken, ...snapshot } = record;
  return snapshot satisfies GitHubConnectionSnapshot;
}

export async function saveGitHubConnection(input: {
  accessToken: string;
  avatarUrl?: string | null;
  email: string;
  githubUserId: string;
  login: string;
  name?: string | null;
  scopes?: string[];
}) {
  await ensureDbSchema();

  const normalizedEmail = normalizeEmail(input.email);
  const now = new Date().toISOString();

  await queryDb(
    `
      INSERT INTO app_github_connections (
        user_email,
        github_user_id,
        github_login,
        github_name,
        github_avatar_url,
        github_scopes,
        access_token_sealed,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::jsonb,
        $7,
        $8,
        $8
      )
      ON CONFLICT (user_email) DO UPDATE
      SET
        github_user_id = EXCLUDED.github_user_id,
        github_login = EXCLUDED.github_login,
        github_name = EXCLUDED.github_name,
        github_avatar_url = EXCLUDED.github_avatar_url,
        github_scopes = EXCLUDED.github_scopes,
        access_token_sealed = EXCLUDED.access_token_sealed,
        updated_at = EXCLUDED.updated_at
    `,
    [
      normalizedEmail,
      input.githubUserId.trim(),
      input.login.trim(),
      readOptionalString(input.name),
      readOptionalString(input.avatarUrl),
      JSON.stringify(input.scopes ?? []),
      sealText(input.accessToken),
      now,
    ],
  );

  return getGitHubConnectionByEmail(normalizedEmail);
}

export async function deleteGitHubConnectionByEmail(email: string) {
  await ensureDbSchema();

  await queryDb(
    `
      DELETE FROM app_github_connections
      WHERE user_email = $1
    `,
    [normalizeEmail(email)],
  );
}

export async function resolveGitHubRepoAuthTokenForEmail(
  email: string,
  options: {
    explicitToken?: string | null;
    repoVisibility: GitHubRepoVisibility;
  },
) {
  const explicitToken = options.explicitToken?.trim() ?? "";

  if (explicitToken) {
    return {
      connection: null,
      source: "manual" as const,
      token: explicitToken,
    };
  }

  if (options.repoVisibility !== "private") {
    return {
      connection: null,
      source: "none" as const,
      token: "",
    };
  }

  const connection = await getGitHubConnectionByEmail(email);

  return {
    connection,
    source: connection ? ("saved" as const) : ("none" as const),
    token: connection?.accessToken ?? "",
  };
}
