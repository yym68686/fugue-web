import "server-only";

import { randomUUID } from "node:crypto";

import { normalizeEmail } from "@/lib/auth/validation";
import { ensureDbSchema, withDbSchemaRetry } from "@/lib/db/schema";
import { queryDb, requireQueryRow } from "@/lib/db/pool";

type GitHubAppImageLinkRow = {
  id: string;
  user_email: string;
  fugue_project_id: string;
  fugue_app_id: string;
  image_ref: string;
  github_repo: string;
  github_workflow: string;
  github_package: string;
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

export type GitHubAppImageLink = {
  id: string;
  userEmail: string;
  fugueProjectId: string | null;
  fugueAppId: string;
  imageRef: string;
  githubRepo: string;
  githubWorkflow: string | null;
  githubPackage: string | null;
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

export type UpsertGitHubAppImageLinkInput = {
  enabled?: boolean;
  fugueAppId: string;
  fugueProjectId?: string | null;
  githubInstallationId?: string | null;
  githubPackage?: string | null;
  githubRepo: string;
  githubWorkflow?: string | null;
  imageRef: string;
  userEmail: string;
};

export type GitHubAppImageLinkEventFilter = {
  githubInstallationId?: string | null;
  githubPackage?: string | null;
  githubRepo: string;
  githubWorkflow?: string | null;
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

function normalizeOptionalFilter(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function normalizeGitHubRepositoryName(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(normalized)) {
    throw new Error("400 githubRepo must be owner/repo.");
  }

  return normalized;
}

function linkFromRow(row: GitHubAppImageLinkRow): GitHubAppImageLink {
  return {
    createdAt: readTimestamp(row.created_at),
    enabled: Boolean(row.enabled),
    fugueProjectId: readOptionalString(row.fugue_project_id),
    fugueAppId: row.fugue_app_id,
    githubInstallationId: readOptionalString(row.github_installation_id),
    githubPackage: readOptionalString(row.github_package),
    githubRepo: row.github_repo,
    githubWorkflow: readOptionalString(row.github_workflow),
    id: row.id,
    imageRef: row.image_ref,
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

function linkMatchesEvent(
  link: GitHubAppImageLink,
  filter: GitHubAppImageLinkEventFilter,
) {
  const installation = normalizeOptionalFilter(filter.githubInstallationId);
  const workflow = normalizeOptionalFilter(filter.githubWorkflow);
  const packageName = normalizeOptionalFilter(filter.githubPackage);

  if (
    link.githubInstallationId &&
    installation &&
    link.githubInstallationId.toLowerCase() !== installation
  ) {
    return false;
  }

  if (
    link.githubWorkflow &&
    workflow &&
    link.githubWorkflow.toLowerCase() !== workflow
  ) {
    return false;
  }

  if (link.githubWorkflow && !workflow) {
    return false;
  }

  if (
    link.githubPackage &&
    packageName &&
    link.githubPackage.toLowerCase() !== packageName
  ) {
    return false;
  }

  if (link.githubPackage && !packageName) {
    return false;
  }

  return true;
}

export async function upsertGitHubAppImageLink(input: UpsertGitHubAppImageLinkInput) {
  await ensureDbSchema();

  const userEmail = normalizeEmail(input.userEmail);
  const githubRepo = normalizeGitHubRepositoryName(input.githubRepo);
  const fugueAppId = input.fugueAppId.trim();
  const fugueProjectId = input.fugueProjectId?.trim() ?? "";
  const imageRef = input.imageRef.trim();

  if (!fugueAppId) {
    throw new Error("400 fugueAppId is required.");
  }

  if (!imageRef) {
    throw new Error("400 imageRef is required.");
  }

  const result = await withDbSchemaRetry(() =>
    queryDb<GitHubAppImageLinkRow>(
      `
        INSERT INTO app_github_app_image_links (
          id,
          user_email,
          fugue_project_id,
          fugue_app_id,
          image_ref,
          github_repo,
          github_workflow,
          github_package,
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '', '', NULL, NULL, '', '', $10, NOW(), NOW())
        ON CONFLICT (user_email, fugue_app_id)
        DO UPDATE SET
          image_ref = EXCLUDED.image_ref,
          fugue_project_id = EXCLUDED.fugue_project_id,
          github_repo = EXCLUDED.github_repo,
          github_workflow = EXCLUDED.github_workflow,
          github_package = EXCLUDED.github_package,
          github_installation_id = EXCLUDED.github_installation_id,
          enabled = EXCLUDED.enabled,
          updated_at = NOW()
        RETURNING
          id,
          user_email,
          fugue_project_id,
          fugue_app_id,
          image_ref,
          github_repo,
          github_workflow,
          github_package,
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
        fugueAppId,
        imageRef,
        githubRepo,
        input.githubWorkflow?.trim() ?? "",
        input.githubPackage?.trim() ?? "",
        input.githubInstallationId?.trim() ?? "",
        input.enabled ?? true,
      ],
    ),
  );

  return linkFromRow(requireQueryRow(result.rows[0], "Saving a GitHub app image link"));
}

export async function getGitHubAppImageLinkForApp(
  userEmail: string,
  fugueAppId: string,
) {
  await ensureDbSchema();

  const result = await withDbSchemaRetry(() =>
    queryDb<GitHubAppImageLinkRow>(
      `
        SELECT
          id,
          user_email,
          fugue_project_id,
          fugue_app_id,
          image_ref,
          github_repo,
          github_workflow,
          github_package,
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
        FROM app_github_app_image_links
        WHERE user_email = $1
          AND fugue_app_id = $2
        LIMIT 1
      `,
      [normalizeEmail(userEmail), fugueAppId.trim()],
    ),
  );

  return result.rows[0] ? linkFromRow(result.rows[0]) : null;
}

export async function listGitHubAppImageLinksForEvent(
  filter: GitHubAppImageLinkEventFilter,
) {
  await ensureDbSchema();

  const githubRepo = normalizeGitHubRepositoryName(filter.githubRepo);
  const installationId = filter.githubInstallationId?.trim() ?? "";

  const result = await withDbSchemaRetry(() =>
    queryDb<GitHubAppImageLinkRow>(
      `
        SELECT
          id,
          user_email,
          fugue_project_id,
          fugue_app_id,
          image_ref,
          github_repo,
          github_workflow,
          github_package,
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
        FROM app_github_app_image_links
        WHERE github_repo = $1
          AND enabled = TRUE
          AND ($2 = '' OR github_installation_id = '' OR github_installation_id = $2)
        ORDER BY updated_at DESC
      `,
      [githubRepo, installationId],
    ),
  );

  return result.rows.map(linkFromRow).filter((link) => linkMatchesEvent(link, filter));
}

export async function listGitHubAppImageLinksForProject(
  userEmail: string,
  fugueProjectId: string,
) {
  await ensureDbSchema();

  const result = await withDbSchemaRetry(() =>
    queryDb<GitHubAppImageLinkRow>(
      `
        SELECT
          id,
          user_email,
          fugue_project_id,
          fugue_app_id,
          image_ref,
          github_repo,
          github_workflow,
          github_package,
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
        FROM app_github_app_image_links
        WHERE user_email = $1
          AND fugue_project_id = $2
        ORDER BY updated_at DESC
      `,
      [normalizeEmail(userEmail), fugueProjectId.trim()],
    ),
  );

  return result.rows.map(linkFromRow);
}

export async function deleteGitHubAppImageLinksForProject(
  userEmail: string,
  fugueProjectId: string,
) {
  await ensureDbSchema();

  await withDbSchemaRetry(() =>
    queryDb(
      `
        DELETE FROM app_github_app_image_links
        WHERE user_email = $1
          AND fugue_project_id = $2
      `,
      [normalizeEmail(userEmail), fugueProjectId.trim()],
    ),
  );
}

export async function recordGitHubAppImageLinkWebhookEvent(input: {
  deliveryId: string;
  eventName: string;
  fugueAppId: string;
  githubInstallationId?: string | null;
}) {
  await ensureDbSchema();

  const result = await withDbSchemaRetry(() =>
    queryDb<GitHubAppImageLinkRow>(
      `
        UPDATE app_github_app_image_links
        SET
          github_installation_id = CASE
            WHEN $4 <> '' THEN $4
            ELSE github_installation_id
          END,
          github_last_webhook_delivery_id = $2,
          github_last_webhook_event_name = $3,
          github_last_webhook_received_at = NOW(),
          updated_at = NOW()
        WHERE fugue_app_id = $1
        RETURNING
          id,
          user_email,
          fugue_project_id,
          fugue_app_id,
          image_ref,
          github_repo,
          github_workflow,
          github_package,
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
        input.fugueAppId.trim(),
        input.deliveryId.trim(),
        input.eventName.trim(),
        input.githubInstallationId?.trim() ?? "",
      ],
    ),
  );

  return result.rows.map(linkFromRow);
}

export async function recordGitHubAppImageLinkSyncResult(input: {
  deliveryId: string;
  error?: string | null;
  fugueAppId: string;
  githubInstallationId?: string | null;
}) {
  await ensureDbSchema();

  const result = await withDbSchemaRetry(() =>
    queryDb<GitHubAppImageLinkRow>(
      `
        UPDATE app_github_app_image_links
        SET
          github_installation_id = CASE
            WHEN $4 <> '' THEN $4
            ELSE github_installation_id
          END,
          github_last_image_sync_at = NOW(),
          github_last_image_sync_delivery_id = $2,
          github_last_image_sync_error = $3,
          updated_at = NOW()
        WHERE fugue_app_id = $1
        RETURNING
          id,
          user_email,
          fugue_project_id,
          fugue_app_id,
          image_ref,
          github_repo,
          github_workflow,
          github_package,
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
        input.fugueAppId.trim(),
        input.deliveryId.trim(),
        input.error?.trim() ?? "",
        input.githubInstallationId?.trim() ?? "",
      ],
    ),
  );

  return result.rows.map(linkFromRow);
}
