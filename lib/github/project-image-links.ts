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
  github_installation_id: string;
  github_last_webhook_delivery_id: string;
  github_last_webhook_event_name: string;
  github_last_webhook_received_at: Date | string | null;
  github_last_image_sync_at: Date | string | null;
  github_last_image_sync_delivery_id: string;
  github_last_image_sync_error: string;
  enabled: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

export type GitHubProjectImageLink = {
  id: string;
  userEmail: string;
  fugueProjectId: string;
  githubRepo: string;
  githubInstallationId: string | null;
  lastImageSyncAt: string | null;
  lastImageSyncDeliveryId: string;
  lastImageSyncError: string | null;
  lastWebhookDeliveryId: string;
  lastWebhookEventName: string;
  lastWebhookReceivedAt: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpsertGitHubProjectImageLinkInput = {
  enabled?: boolean;
  fugueProjectId: string;
  githubInstallationId?: string | null;
  githubRepo: string;
  userEmail: string;
};

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

function linkFromRow(row: GitHubProjectImageLinkRow): GitHubProjectImageLink {
  return {
    createdAt: readTimestamp(row.created_at),
    enabled: Boolean(row.enabled),
    fugueProjectId: row.fugue_project_id,
    githubInstallationId: readOptionalString(row.github_installation_id),
    githubRepo: row.github_repo,
    id: row.id,
    lastImageSyncAt: readOptionalString(row.github_last_image_sync_at)
      ? readTimestamp(row.github_last_image_sync_at)
      : null,
    lastImageSyncDeliveryId: row.github_last_image_sync_delivery_id,
    lastImageSyncError: readOptionalString(row.github_last_image_sync_error),
    lastWebhookDeliveryId: row.github_last_webhook_delivery_id,
    lastWebhookEventName: row.github_last_webhook_event_name,
    lastWebhookReceivedAt: readOptionalString(row.github_last_webhook_received_at)
      ? readTimestamp(row.github_last_webhook_received_at)
      : null,
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
          github_installation_id,
          github_last_webhook_delivery_id,
          github_last_webhook_event_name,
          github_last_webhook_received_at,
          github_last_image_sync_at,
          github_last_image_sync_delivery_id,
          github_last_image_sync_error,
          enabled,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, '', '', NULL, NULL, '', '', $6, NOW(), NOW())
        ON CONFLICT (user_email, fugue_project_id)
        DO UPDATE SET
          github_repo = EXCLUDED.github_repo,
          github_installation_id = EXCLUDED.github_installation_id,
          enabled = EXCLUDED.enabled,
          updated_at = NOW()
        RETURNING
          id,
          user_email,
          fugue_project_id,
          github_repo,
          github_installation_id,
          github_last_webhook_delivery_id,
          github_last_webhook_event_name,
          github_last_webhook_received_at,
          github_last_image_sync_at,
          github_last_image_sync_delivery_id,
          github_last_image_sync_error,
          enabled,
          created_at,
          updated_at
      `,
      [
        randomUUID(),
        userEmail,
        fugueProjectId,
        githubRepo,
        input.githubInstallationId?.trim() ?? "",
        input.enabled ?? true,
      ],
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
          github_installation_id,
          github_last_webhook_delivery_id,
          github_last_webhook_event_name,
          github_last_webhook_received_at,
          github_last_image_sync_at,
          github_last_image_sync_delivery_id,
          github_last_image_sync_error,
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

export async function recordGitHubProjectImageWebhookEvent(input: {
  deliveryId: string;
  eventName: string;
  githubInstallationId?: string | null;
  githubRepo: string;
  userEmail: string;
}) {
  await ensureDbSchema();

  const result = await withDbSchemaRetry(() =>
    queryDb<GitHubProjectImageLinkRow>(
      `
        UPDATE app_github_project_image_links
        SET
          github_installation_id = CASE
            WHEN $5 <> '' THEN $5
            ELSE github_installation_id
          END,
          github_last_webhook_delivery_id = $3,
          github_last_webhook_event_name = $4,
          github_last_webhook_received_at = NOW(),
          updated_at = NOW()
        WHERE user_email = $1
          AND github_repo = $2
        RETURNING
          id,
          user_email,
          fugue_project_id,
          github_repo,
          github_installation_id,
          github_last_webhook_delivery_id,
          github_last_webhook_event_name,
          github_last_webhook_received_at,
          github_last_image_sync_at,
          github_last_image_sync_delivery_id,
          github_last_image_sync_error,
          enabled,
          created_at,
          updated_at
      `,
      [
        normalizeEmail(input.userEmail),
        normalizeGitHubRepositoryName(input.githubRepo),
        input.deliveryId.trim(),
        input.eventName.trim(),
        input.githubInstallationId?.trim() ?? "",
      ],
    ),
  );

  return result.rows.map(linkFromRow);
}

export async function recordGitHubProjectImageSyncResult(input: {
  deliveryId: string;
  error?: string | null;
  githubInstallationId?: string | null;
  githubRepo: string;
  userEmail: string;
}) {
  await ensureDbSchema();

  const result = await withDbSchemaRetry(() =>
    queryDb<GitHubProjectImageLinkRow>(
      `
        UPDATE app_github_project_image_links
        SET
          github_installation_id = CASE
            WHEN $5 <> '' THEN $5
            ELSE github_installation_id
          END,
          github_last_image_sync_at = NOW(),
          github_last_image_sync_delivery_id = $3,
          github_last_image_sync_error = $4,
          updated_at = NOW()
        WHERE user_email = $1
          AND github_repo = $2
        RETURNING
          id,
          user_email,
          fugue_project_id,
          github_repo,
          github_installation_id,
          github_last_webhook_delivery_id,
          github_last_webhook_event_name,
          github_last_webhook_received_at,
          github_last_image_sync_at,
          github_last_image_sync_delivery_id,
          github_last_image_sync_error,
          enabled,
          created_at,
          updated_at
      `,
      [
        normalizeEmail(input.userEmail),
        normalizeGitHubRepositoryName(input.githubRepo),
        input.deliveryId.trim(),
        input.error?.trim() ?? "",
        input.githubInstallationId?.trim() ?? "",
      ],
    ),
  );

  return result.rows.map(linkFromRow);
}
