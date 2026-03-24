import "server-only";

import type { PoolClient } from "pg";

import type { FugueApiKey } from "@/lib/fugue/api";
import type {
  ApiKeyRecord,
  ApiKeySource,
  ApiKeyStatus,
} from "@/lib/api-keys/types";
import { sortFugueScopes } from "@/lib/fugue/scopes";
import { ensureDbSchema } from "@/lib/db/schema";
import { queryDb, withDbTransaction } from "@/lib/db/pool";
import { sealText, unsealText } from "@/lib/security/seal";
import { normalizeEmail } from "@/lib/auth/validation";

type ApiKeyRow = {
  created_at: Date | string;
  deleted_at: Date | string | null;
  disabled_at: Date | string | null;
  fugue_key_id: string;
  is_workspace_admin: boolean;
  label: string;
  last_synced_at: Date | string | null;
  last_used_at: Date | string | null;
  prefix: string | null;
  scopes: unknown;
  secret_sealed: string | null;
  source: ApiKeySource;
  status: ApiKeyStatus;
  tenant_id: string;
  updated_at: Date | string;
  user_email: string;
};

type SyncApiKeysInput = {
  email: string;
  tenantId: string;
  visibleKeys: FugueApiKey[];
};

type SaveApiKeyInput = {
  apiKey: Pick<FugueApiKey, "createdAt" | "id" | "label" | "lastUsedAt" | "prefix" | "scopes">;
  email: string;
  secret?: string | null;
  source: ApiKeySource;
  status?: ApiKeyStatus;
  tenantId: string;
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

  return null;
}

function readStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
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

function recordFromRow(row: ApiKeyRow): ApiKeyRecord {
  const isWorkspaceAdmin = Boolean(row.is_workspace_admin);
  const status = row.status;

  return {
    canCopy: Boolean(row.secret_sealed) && status !== "deleted",
    canDelete: !isWorkspaceAdmin && status !== "deleted",
    canDisable: !isWorkspaceAdmin && status !== "deleted",
    createdAt: readTimestamp(row.created_at) ?? new Date().toISOString(),
    deletedAt: readTimestamp(row.deleted_at),
    disabledAt: readTimestamp(row.disabled_at),
    id: row.fugue_key_id,
    isWorkspaceAdmin,
    label: row.label,
    lastSyncedAt: readTimestamp(row.last_synced_at),
    lastUsedAt: readTimestamp(row.last_used_at),
    prefix: readOptionalString(row.prefix),
    scopes: sortFugueScopes(readStringArray(row.scopes)),
    secretStored: Boolean(row.secret_sealed),
    source: row.source,
    status,
    tenantId: row.tenant_id,
    updatedAt: readTimestamp(row.updated_at) ?? new Date().toISOString(),
    userEmail: normalizeEmail(row.user_email),
  };
}

async function getApiKeyRow(
  client: PoolClient,
  email: string,
  fugueKeyId: string,
) {
  const result = await client.query<ApiKeyRow>(
    `
      SELECT
        fugue_key_id,
        user_email,
        tenant_id,
        label,
        prefix,
        scopes,
        secret_sealed,
        status,
        source,
        is_workspace_admin,
        last_used_at,
        disabled_at,
        deleted_at,
        last_synced_at,
        created_at,
        updated_at
      FROM app_api_keys
      WHERE user_email = $1
        AND fugue_key_id = $2
      LIMIT 1
    `,
    [normalizeEmail(email), fugueKeyId],
  );

  return result.rows[0] ?? null;
}

async function upsertVisibleApiKey(
  client: PoolClient,
  input: SaveApiKeyInput,
) {
  const normalizedEmail = normalizeEmail(input.email);
  const now = new Date().toISOString();
  const createdAt = readTimestamp(input.apiKey.createdAt) ?? now;
  const secretSealed = input.secret ? sealText(input.secret) : null;

  await client.query(
    `
      INSERT INTO app_api_keys (
        fugue_key_id,
        user_email,
        tenant_id,
        label,
        prefix,
        scopes,
        secret_sealed,
        status,
        source,
        is_workspace_admin,
        last_used_at,
        disabled_at,
        deleted_at,
        last_synced_at,
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
        $9,
        $10,
        $11,
        NULL,
        NULL,
        $12,
        $13,
        $12
      )
      ON CONFLICT (fugue_key_id) DO UPDATE
      SET
        user_email = EXCLUDED.user_email,
        tenant_id = EXCLUDED.tenant_id,
        label = EXCLUDED.label,
        prefix = COALESCE(EXCLUDED.prefix, app_api_keys.prefix),
        scopes = EXCLUDED.scopes,
        secret_sealed = COALESCE(app_api_keys.secret_sealed, EXCLUDED.secret_sealed),
        last_used_at = EXCLUDED.last_used_at,
        last_synced_at = EXCLUDED.last_synced_at,
        updated_at = EXCLUDED.updated_at,
        source = CASE
          WHEN app_api_keys.source IN ('workspace-admin', 'managed') THEN app_api_keys.source
          ELSE EXCLUDED.source
        END,
        status = app_api_keys.status,
        is_workspace_admin = app_api_keys.is_workspace_admin OR EXCLUDED.is_workspace_admin
    `,
    [
      input.apiKey.id,
      normalizedEmail,
      input.tenantId,
      input.apiKey.label,
      input.apiKey.prefix ?? null,
      JSON.stringify(sortFugueScopes(input.apiKey.scopes)),
      secretSealed,
      input.status ?? "active",
      input.source,
      input.source === "workspace-admin",
      input.apiKey.lastUsedAt,
      now,
      createdAt,
    ],
  );
}

export async function saveApiKeyRecord(input: SaveApiKeyInput) {
  await ensureDbSchema();

  return withDbTransaction(async (client) => {
    await upsertVisibleApiKey(client, input);
    const row = await getApiKeyRow(client, input.email, input.apiKey.id);

    if (!row) {
      throw new Error("Failed to persist API key.");
    }

    return recordFromRow(row);
  });
}

export async function syncApiKeysForWorkspace(input: SyncApiKeysInput) {
  await ensureDbSchema();

  return withDbTransaction(async (client) => {
    for (const apiKey of input.visibleKeys) {
      await upsertVisibleApiKey(client, {
        apiKey,
        email: input.email,
        source: "external",
        tenantId: input.tenantId,
      });
    }

    const result = await client.query<ApiKeyRow>(
      `
        SELECT
          fugue_key_id,
          user_email,
          tenant_id,
          label,
          prefix,
          scopes,
          secret_sealed,
          status,
          source,
          is_workspace_admin,
          last_used_at,
          disabled_at,
          deleted_at,
          last_synced_at,
          created_at,
          updated_at
        FROM app_api_keys
        WHERE user_email = $1
          AND tenant_id = $2
          AND status <> 'deleted'
        ORDER BY
          is_workspace_admin DESC,
          CASE status
            WHEN 'active' THEN 0
            WHEN 'disabled' THEN 1
            ELSE 2
          END,
          created_at DESC,
          label ASC
      `,
      [normalizeEmail(input.email), input.tenantId],
    );

    return result.rows.map(recordFromRow);
  });
}

export async function listApiKeysByEmail(
  email: string,
  options?: {
    includeDeleted?: boolean;
    tenantId?: string | null;
  },
) {
  await ensureDbSchema();

  const normalizedEmail = normalizeEmail(email);
  const includeDeleted = options?.includeDeleted ?? false;
  const tenantId = readOptionalString(options?.tenantId ?? null);
  const values: unknown[] = [normalizedEmail];
  const filters = ["user_email = $1"];

  if (!includeDeleted) {
    filters.push("status <> 'deleted'");
  }

  if (tenantId) {
    values.push(tenantId);
    filters.push(`tenant_id = $${values.length}`);
  }

  const result = await queryDb<ApiKeyRow>(
    `
      SELECT
        fugue_key_id,
        user_email,
        tenant_id,
        label,
        prefix,
        scopes,
        secret_sealed,
        status,
        source,
        is_workspace_admin,
        last_used_at,
        disabled_at,
        deleted_at,
        last_synced_at,
        created_at,
        updated_at
      FROM app_api_keys
      WHERE ${filters.join(" AND ")}
      ORDER BY
        is_workspace_admin DESC,
        CASE status
          WHEN 'active' THEN 0
          WHEN 'disabled' THEN 1
          ELSE 2
        END,
        created_at DESC,
        label ASC
    `,
    values,
  );

  return result.rows.map(recordFromRow);
}

export async function getApiKeyRecordById(
  email: string,
  fugueKeyId: string,
  options?: {
    includeDeleted?: boolean;
  },
) {
  await ensureDbSchema();

  const normalizedEmail = normalizeEmail(email);
  const includeDeleted = options?.includeDeleted ?? false;
  const result = await queryDb<ApiKeyRow>(
    `
      SELECT
        fugue_key_id,
        user_email,
        tenant_id,
        label,
        prefix,
        scopes,
        secret_sealed,
        status,
        source,
        is_workspace_admin,
        last_used_at,
        disabled_at,
        deleted_at,
        last_synced_at,
        created_at,
        updated_at
      FROM app_api_keys
      WHERE user_email = $1
        AND fugue_key_id = $2
        AND ($3::boolean OR status <> 'deleted')
      LIMIT 1
    `,
    [normalizedEmail, fugueKeyId, includeDeleted],
  );

  const row = result.rows[0];
  return row ? recordFromRow(row) : null;
}

export async function setApiKeyStatus(
  email: string,
  fugueKeyId: string,
  status: ApiKeyStatus,
) {
  await ensureDbSchema();

  const normalizedEmail = normalizeEmail(email);
  const now = new Date().toISOString();
  const result = await queryDb<ApiKeyRow>(
    `
      UPDATE app_api_keys
      SET
        status = $3,
        disabled_at = CASE WHEN $3 = 'disabled' THEN $4 ELSE NULL END,
        deleted_at = CASE WHEN $3 = 'deleted' THEN $4 ELSE NULL END,
        updated_at = $4
      WHERE user_email = $1
        AND fugue_key_id = $2
      RETURNING
        fugue_key_id,
        user_email,
        tenant_id,
        label,
        prefix,
        scopes,
        secret_sealed,
        status,
        source,
        is_workspace_admin,
        last_used_at,
        disabled_at,
        deleted_at,
        last_synced_at,
        created_at,
        updated_at
    `,
    [normalizedEmail, fugueKeyId, status, now],
  );

  const row = result.rows[0];
  return row ? recordFromRow(row) : null;
}

export async function getApiKeySecret(email: string, fugueKeyId: string) {
  await ensureDbSchema();

  const result = await queryDb<Pick<ApiKeyRow, "secret_sealed">>(
    `
      SELECT secret_sealed
      FROM app_api_keys
      WHERE user_email = $1
        AND fugue_key_id = $2
        AND status <> 'deleted'
      LIMIT 1
    `,
    [normalizeEmail(email), fugueKeyId],
  );

  const secretSealed = result.rows[0]?.secret_sealed;
  return secretSealed ? unsealText(secretSealed) : null;
}
