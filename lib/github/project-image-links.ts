import "server-only";

import { randomUUID } from "node:crypto";

import { normalizeEmail } from "@/lib/auth/validation";
import { ensureDbSchema, withDbSchemaRetry } from "@/lib/db/schema";
import { queryDb } from "@/lib/db/pool";
import { normalizeGitHubRepositoryName } from "@/lib/github/app-image-links";

type GitHubProjectImageLinkRow = {
  id: string;
  user_email: string;
  fugue_project_id: string;
  github_repo: string;
  enabled: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

export type GitHubProjectImageLink = {
  id: string;
  userEmail: string;
  fugueProjectId: string;
  githubRepo: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpsertGitHubProjectImageLinkInput = {
  enabled?: boolean;
  fugueProjectId: string;
  githubRepo: string;
  userEmail: string;
};

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

function linkFromRow(row: GitHubProjectImageLinkRow): GitHubProjectImageLink {
  return {
    createdAt: readTimestamp(row.created_at),
    enabled: Boolean(row.enabled),
    fugueProjectId: row.fugue_project_id,
    githubRepo: row.github_repo,
    id: row.id,
    updatedAt: readTimestamp(row.updated_at),
    userEmail: normalizeEmail(row.user_email),
  };
}

export async function upsertGitHubProjectImageLink(
  input: UpsertGitHubProjectImageLinkInput,
) {
  await ensureDbSchema();

  const userEmail = normalizeEmail(input.userEmail);
  const fugueProjectId = input.fugueProjectId.trim();
  const githubRepo = normalizeGitHubRepositoryName(input.githubRepo);

  if (!fugueProjectId) {
    throw new Error("400 fugueProjectId is required.");
  }

  const result = await withDbSchemaRetry(() =>
    queryDb<GitHubProjectImageLinkRow>(
      `
        INSERT INTO app_github_project_image_links (
          id,
          user_email,
          fugue_project_id,
          github_repo,
          enabled,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (user_email, fugue_project_id)
        DO UPDATE SET
          github_repo = EXCLUDED.github_repo,
          enabled = EXCLUDED.enabled,
          updated_at = NOW()
        RETURNING
          id,
          user_email,
          fugue_project_id,
          github_repo,
          enabled,
          created_at,
          updated_at
      `,
      [randomUUID(), userEmail, fugueProjectId, githubRepo, input.enabled ?? true],
    ),
  );

  return linkFromRow(result.rows[0]);
}

export async function getGitHubProjectImageLink(
  userEmail: string,
  fugueProjectId: string,
) {
  await ensureDbSchema();

  const result = await withDbSchemaRetry(() =>
    queryDb<GitHubProjectImageLinkRow>(
      `
        SELECT
          id,
          user_email,
          fugue_project_id,
          github_repo,
          enabled,
          created_at,
          updated_at
        FROM app_github_project_image_links
        WHERE user_email = $1
          AND fugue_project_id = $2
        LIMIT 1
      `,
      [normalizeEmail(userEmail), fugueProjectId.trim()],
    ),
  );

  return result.rows[0] ? linkFromRow(result.rows[0]) : null;
}
