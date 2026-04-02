import "server-only";

import type { PoolClient } from "pg";

import type { FugueNodeKey } from "@/lib/fugue/api";
import type {
  NodeKeyRecord,
  NodeKeySource,
  NodeKeyStatus,
} from "@/lib/node-keys/types";
import { ensureDbSchema } from "@/lib/db/schema";
import { queryDb, withDbTransaction } from "@/lib/db/pool";
import { sealText, unsealText } from "@/lib/security/seal";
import { normalizeEmail } from "@/lib/auth/validation";

type NodeKeyRow = {
  created_at: Date | string;
  fugue_node_key_id: string;
  hash: string | null;
  label: string;
  label_override: string | null;
  last_synced_at: Date | string | null;
  last_used_at: Date | string | null;
  prefix: string | null;
  revoked_at: Date | string | null;
  secret_sealed: string | null;
  source: NodeKeySource;
  status: NodeKeyStatus;
  tenant_id: string;
  updated_at: Date | string;
  user_email: string;
};

type SyncNodeKeysInput = {
  email: string;
  tenantId: string;
  visibleKeys: FugueNodeKey[];
};

type SaveNodeKeyInput = {
  email: string;
  nodeKey: Pick<
    FugueNodeKey,
    | "createdAt"
    | "hash"
    | "id"
    | "label"
    | "lastUsedAt"
    | "prefix"
    | "revokedAt"
    | "status"
    | "updatedAt"
  >;
  secret?: string | null;
  source: NodeKeySource;
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

function normalizeNodeKeyStatus(
  status: string | null | undefined,
  revokedAt?: string | null,
): NodeKeyStatus {
  if (
    typeof status === "string" &&
    status.trim().toLowerCase() === "revoked"
  ) {
    return "revoked";
  }

  return revokedAt ? "revoked" : "active";
}

function readDisplayLabel(row: Pick<NodeKeyRow, "label" | "label_override">) {
  return readOptionalString(row.label_override) ?? row.label;
}

function recordFromRow(row: NodeKeyRow): NodeKeyRecord {
  const status = row.status;

  return {
    attachedVpsCount: null,
    canCopy: Boolean(row.secret_sealed) && status === "active",
    canRevoke: status === "active",
    createdAt: readTimestamp(row.created_at) ?? new Date().toISOString(),
    hash: readOptionalString(row.hash),
    id: row.fugue_node_key_id,
    label: readDisplayLabel(row),
    lastSyncedAt: readTimestamp(row.last_synced_at),
    lastUsedAt: readTimestamp(row.last_used_at),
    prefix: readOptionalString(row.prefix),
    revokedAt: readTimestamp(row.revoked_at),
    secretStored: Boolean(row.secret_sealed),
    source: row.source,
    status,
    tenantId: row.tenant_id,
    updatedAt: readTimestamp(row.updated_at) ?? new Date().toISOString(),
    userEmail: normalizeEmail(row.user_email),
  };
}

async function getNodeKeyRow(
  client: PoolClient,
  email: string,
  fugueNodeKeyId: string,
) {
  const result = await client.query<NodeKeyRow>(
    `
      SELECT
        fugue_node_key_id,
        user_email,
        tenant_id,
        label,
        label_override,
        prefix,
        hash,
        secret_sealed,
        status,
        source,
        last_used_at,
        revoked_at,
        last_synced_at,
        created_at,
        updated_at
      FROM app_node_keys
      WHERE user_email = $1
        AND fugue_node_key_id = $2
      LIMIT 1
    `,
    [normalizeEmail(email), fugueNodeKeyId],
  );

  return result.rows[0] ?? null;
}

async function upsertVisibleNodeKey(
  client: PoolClient,
  input: SaveNodeKeyInput,
) {
  const normalizedEmail = normalizeEmail(input.email);
  const now = new Date().toISOString();
  const createdAt = readTimestamp(input.nodeKey.createdAt) ?? now;
  const updatedAt = readTimestamp(input.nodeKey.updatedAt) ?? now;
  const status = normalizeNodeKeyStatus(
    input.nodeKey.status,
    input.nodeKey.revokedAt,
  );
  const revokedAt =
    status === "revoked"
      ? readTimestamp(input.nodeKey.revokedAt) ?? updatedAt
      : null;
  const secretSealed = input.secret ? sealText(input.secret) : null;

  await client.query(
    `
      INSERT INTO app_node_keys (
        fugue_node_key_id,
        user_email,
        tenant_id,
        label,
        prefix,
        hash,
        secret_sealed,
        status,
        source,
        last_used_at,
        revoked_at,
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
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14
      )
      ON CONFLICT (fugue_node_key_id) DO UPDATE
      SET
        user_email = EXCLUDED.user_email,
        tenant_id = EXCLUDED.tenant_id,
        label = EXCLUDED.label,
        prefix = COALESCE(EXCLUDED.prefix, app_node_keys.prefix),
        hash = COALESCE(EXCLUDED.hash, app_node_keys.hash),
        secret_sealed = CASE
          WHEN EXCLUDED.status = 'revoked'
            THEN NULL
          ELSE COALESCE(EXCLUDED.secret_sealed, app_node_keys.secret_sealed)
        END,
        last_used_at = COALESCE(EXCLUDED.last_used_at, app_node_keys.last_used_at),
        revoked_at = CASE
          WHEN app_node_keys.status = 'revoked'
            THEN COALESCE(app_node_keys.revoked_at, EXCLUDED.revoked_at)
          WHEN EXCLUDED.status = 'revoked'
            THEN EXCLUDED.revoked_at
          ELSE NULL
        END,
        last_synced_at = EXCLUDED.last_synced_at,
        updated_at = EXCLUDED.updated_at,
        source = CASE
          WHEN app_node_keys.source = 'managed' THEN app_node_keys.source
          ELSE EXCLUDED.source
        END,
        status = CASE
          WHEN app_node_keys.status = 'revoked' THEN 'revoked'
          ELSE EXCLUDED.status
        END
    `,
    [
      input.nodeKey.id,
      normalizedEmail,
      input.tenantId,
      input.nodeKey.label,
      input.nodeKey.prefix ?? null,
      input.nodeKey.hash ?? null,
      secretSealed,
      status,
      input.source,
      input.nodeKey.lastUsedAt,
      revokedAt,
      now,
      createdAt,
      updatedAt,
    ],
  );
}

export async function saveNodeKeyRecord(input: SaveNodeKeyInput) {
  await ensureDbSchema();

  return withDbTransaction(async (client) => {
    await upsertVisibleNodeKey(client, input);
    const row = await getNodeKeyRow(client, input.email, input.nodeKey.id);

    if (!row) {
      throw new Error("Failed to persist node key.");
    }

    return recordFromRow(row);
  });
}

export async function renameNodeKeyRecord(
  email: string,
  fugueNodeKeyId: string,
  nextLabel: string,
) {
  await ensureDbSchema();

  return withDbTransaction(async (client) => {
    const row = await getNodeKeyRow(client, email, fugueNodeKeyId);

    if (!row) {
      throw new Error("Node key not found.");
    }

    const label = nextLabel.trim();

    if (!label) {
      throw new Error("Node key name is required.");
    }

    const labelOverride = label === row.label ? null : label;
    const updatedAt = new Date().toISOString();
    const result = await client.query<NodeKeyRow>(
      `
        UPDATE app_node_keys
        SET label_override = $3,
            updated_at = $4
        WHERE user_email = $1
          AND fugue_node_key_id = $2
        RETURNING
          fugue_node_key_id,
          user_email,
          tenant_id,
          label,
          label_override,
          prefix,
          hash,
          secret_sealed,
          status,
          source,
          last_used_at,
          revoked_at,
          last_synced_at,
          created_at,
          updated_at
      `,
      [normalizeEmail(email), fugueNodeKeyId, labelOverride, updatedAt],
    );

    const nextRow = result.rows[0];

    if (!nextRow) {
      throw new Error("Failed to persist node key.");
    }

    return recordFromRow(nextRow);
  });
}

export async function syncNodeKeysForWorkspace(input: SyncNodeKeysInput) {
  await ensureDbSchema();

  return withDbTransaction(async (client) => {
    for (const nodeKey of input.visibleKeys) {
      await upsertVisibleNodeKey(client, {
        email: input.email,
        nodeKey,
        source: "external",
        tenantId: input.tenantId,
      });
    }

    const result = await client.query<NodeKeyRow>(
      `
        SELECT
          fugue_node_key_id,
          user_email,
          tenant_id,
          label,
          label_override,
          prefix,
          hash,
          secret_sealed,
          status,
          source,
          last_used_at,
          revoked_at,
          last_synced_at,
          created_at,
          updated_at
        FROM app_node_keys
        WHERE user_email = $1
          AND tenant_id = $2
        ORDER BY
          CASE status
            WHEN 'active' THEN 0
            ELSE 1
          END,
          created_at DESC,
          COALESCE(NULLIF(BTRIM(label_override), ''), label) ASC
      `,
      [normalizeEmail(input.email), input.tenantId],
    );

    return result.rows.map(recordFromRow);
  });
}

export async function listNodeKeysByEmail(
  email: string,
  options?: {
    tenantId?: string | null;
  },
) {
  await ensureDbSchema();

  const normalizedEmail = normalizeEmail(email);
  const tenantId = readOptionalString(options?.tenantId ?? null);
  const values: unknown[] = [normalizedEmail];
  const filters = ["user_email = $1"];

  if (tenantId) {
    values.push(tenantId);
    filters.push(`tenant_id = $${values.length}`);
  }

  const result = await queryDb<NodeKeyRow>(
    `
      SELECT
        fugue_node_key_id,
        user_email,
        tenant_id,
        label,
        label_override,
        prefix,
        hash,
        secret_sealed,
        status,
        source,
        last_used_at,
        revoked_at,
        last_synced_at,
        created_at,
        updated_at
      FROM app_node_keys
      WHERE ${filters.join(" AND ")}
      ORDER BY
        CASE status
          WHEN 'active' THEN 0
          ELSE 1
        END,
        created_at DESC,
        COALESCE(NULLIF(BTRIM(label_override), ''), label) ASC
    `,
    values,
  );

  return result.rows.map(recordFromRow);
}

export async function getNodeKeyRecordById(
  email: string,
  fugueNodeKeyId: string,
) {
  await ensureDbSchema();

  const result = await queryDb<NodeKeyRow>(
    `
      SELECT
        fugue_node_key_id,
        user_email,
        tenant_id,
        label,
        label_override,
        prefix,
        hash,
        secret_sealed,
        status,
        source,
        last_used_at,
        revoked_at,
        last_synced_at,
        created_at,
        updated_at
      FROM app_node_keys
      WHERE user_email = $1
        AND fugue_node_key_id = $2
      LIMIT 1
    `,
    [normalizeEmail(email), fugueNodeKeyId],
  );

  const row = result.rows[0];
  return row ? recordFromRow(row) : null;
}

export async function getNodeKeySecret(email: string, fugueNodeKeyId: string) {
  await ensureDbSchema();

  const result = await queryDb<Pick<NodeKeyRow, "secret_sealed">>(
    `
      SELECT secret_sealed
      FROM app_node_keys
      WHERE user_email = $1
        AND fugue_node_key_id = $2
        AND status = 'active'
      LIMIT 1
    `,
    [normalizeEmail(email), fugueNodeKeyId],
  );

  const secretSealed = result.rows[0]?.secret_sealed;
  return secretSealed ? unsealText(secretSealed) : null;
}
