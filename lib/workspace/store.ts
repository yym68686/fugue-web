import "server-only";

import type { PoolClient } from "pg";

import { ensureAppUserRecord } from "@/lib/app-users/store";
import type { SessionUser } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/validation";
import { ensureDbSchema, withDbSchemaRetry } from "@/lib/db/schema";
import { queryDb, requireQueryRow, withDbTransaction } from "@/lib/db/pool";
import { sealText, unsealText } from "@/lib/security/seal";

type WorkspaceRow = {
  admin_key_id: string;
  admin_key_label: string;
  admin_key_prefix: string | null;
  admin_key_scopes: unknown;
  admin_key_secret_sealed: string;
  created_at: Date | string;
  default_project_id: string | null;
  default_project_name: string | null;
  first_app_id: string | null;
  tenant_id: string;
  tenant_name: string;
  updated_at: Date | string;
  user_email: string;
};

export type WorkspaceSnapshot = {
  adminKeyId: string;
  adminKeyLabel: string;
  adminKeyPrefix: string | null;
  adminKeyScopes: string[];
  createdAt: string;
  defaultProjectId: string | null;
  defaultProjectName: string | null;
  email: string;
  firstAppId: string | null;
  tenantId: string;
  tenantName: string;
  updatedAt: string;
};

export type WorkspaceAccess = WorkspaceSnapshot & {
  adminKeySecret: string;
};

export type WorkspaceBootstrapState = WorkspaceSnapshot & {
  adminKeySecret: string | null;
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

function readStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
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

function snapshotFromRow(row: WorkspaceRow): WorkspaceSnapshot {
  return {
    adminKeyId: row.admin_key_id,
    adminKeyLabel: row.admin_key_label,
    adminKeyPrefix: readOptionalString(row.admin_key_prefix),
    adminKeyScopes: readStringArray(row.admin_key_scopes),
    createdAt: readTimestamp(row.created_at),
    defaultProjectId: readOptionalString(row.default_project_id),
    defaultProjectName: readOptionalString(row.default_project_name),
    email: normalizeEmail(row.user_email),
    firstAppId: readOptionalString(row.first_app_id),
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    updatedAt: readTimestamp(row.updated_at),
  };
}

function accessFromRow(row: WorkspaceRow): WorkspaceAccess {
  return {
    ...snapshotFromRow(row),
    adminKeySecret: unsealText(row.admin_key_secret_sealed),
  };
}

function bootstrapStateFromRow(row: WorkspaceRow): WorkspaceBootstrapState {
  const snapshot = snapshotFromRow(row);

  try {
    return {
      ...snapshot,
      adminKeySecret: unsealText(row.admin_key_secret_sealed),
    };
  } catch {
    return {
      ...snapshot,
      adminKeySecret: null,
    };
  }
}

async function getWorkspaceRowByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const result = await withDbSchemaRetry(() =>
    queryDb<WorkspaceRow>(
      `
        SELECT
          user_email,
          tenant_id,
          tenant_name,
          default_project_id,
          default_project_name,
          first_app_id,
          admin_key_id,
          admin_key_label,
          admin_key_prefix,
          admin_key_scopes,
          admin_key_secret_sealed,
          created_at,
          updated_at
        FROM app_workspaces
        WHERE user_email = $1
        LIMIT 1
      `,
      [normalizedEmail],
    ),
  );

  return result.rows[0] ?? null;
}

async function getWorkspaceRowByTenantId(tenantId: string) {
  const result = await withDbSchemaRetry(() =>
    queryDb<WorkspaceRow>(
      `
        SELECT
          user_email,
          tenant_id,
          tenant_name,
          default_project_id,
          default_project_name,
          first_app_id,
          admin_key_id,
          admin_key_label,
          admin_key_prefix,
          admin_key_scopes,
          admin_key_secret_sealed,
          created_at,
          updated_at
        FROM app_workspaces
        WHERE tenant_id = $1
        LIMIT 1
      `,
      [tenantId.trim()],
    ),
  );

  return result.rows[0] ?? null;
}

async function ensureUserStub(client: PoolClient, email: string) {
  const normalizedEmail = normalizeEmail(email);
  const now = new Date().toISOString();

  await client.query(
    `
      INSERT INTO app_users (
        email,
        provider,
        verified,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO NOTHING
    `,
    [normalizedEmail, "email", false, now, now],
  );
}

async function upsertWorkspaceAdminKey(client: PoolClient, record: WorkspaceAccess) {
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
        'active',
        'workspace-admin',
        TRUE,
        NULL,
        NULL,
        NULL,
        $8,
        $9,
        $8
      )
      ON CONFLICT (fugue_key_id) DO UPDATE
      SET
        user_email = EXCLUDED.user_email,
        tenant_id = EXCLUDED.tenant_id,
        label = EXCLUDED.label,
        prefix = EXCLUDED.prefix,
        scopes = EXCLUDED.scopes,
        secret_sealed = EXCLUDED.secret_sealed,
        status = 'active',
        source = 'workspace-admin',
        is_workspace_admin = TRUE,
        disabled_at = NULL,
        deleted_at = NULL,
        last_synced_at = EXCLUDED.last_synced_at,
        updated_at = EXCLUDED.updated_at
    `,
    [
      record.adminKeyId,
      normalizeEmail(record.email),
      record.tenantId,
      record.adminKeyLabel,
      record.adminKeyPrefix,
      JSON.stringify(record.adminKeyScopes),
      sealText(record.adminKeySecret),
      record.updatedAt,
      record.createdAt,
    ],
  );
}

export async function ensureAppUser(user: SessionUser) {
  return ensureAppUserRecord(user);
}

/**
 * Persist a user-minted API key into the local mirror the /keys page reads
 * from. The secret is intentionally NOT stored (secret_sealed = NULL): unlike
 * the workspace admin key, the app never acts with this key, so it is revealed
 * to the user once at creation and then only its metadata is retained. Marked
 * source='managed' (created through the console) and is_workspace_admin=FALSE.
 */
export async function persistManagedApiKey(input: {
  email: string;
  key: {
    id: string;
    tenantId: string;
    label: string;
    prefix: string | null;
    scopes: string[];
    createdAt: string | null;
  };
}) {
  const now = new Date().toISOString();
  const createdAt = input.key.createdAt ?? now;

  await withDbSchemaRetry(() =>
    queryDb(
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
          $1, $2, $3, $4, $5, $6::jsonb,
          NULL, 'active', 'managed', FALSE,
          NULL, NULL, NULL, $7, $8, $7
        )
        ON CONFLICT (fugue_key_id) DO UPDATE
        SET
          user_email = EXCLUDED.user_email,
          tenant_id = EXCLUDED.tenant_id,
          label = EXCLUDED.label,
          prefix = EXCLUDED.prefix,
          scopes = EXCLUDED.scopes,
          status = 'active',
          source = 'managed',
          is_workspace_admin = FALSE,
          disabled_at = NULL,
          deleted_at = NULL,
          last_synced_at = EXCLUDED.last_synced_at,
          updated_at = EXCLUDED.updated_at
      `,
      [
        input.key.id,
        normalizeEmail(input.email),
        input.key.tenantId,
        input.key.label,
        input.key.prefix,
        JSON.stringify(input.key.scopes),
        now,
        createdAt,
      ],
    ),
  );
}

/**
 * Reflect a managed API key's new status into the local mirror the /keys page
 * reads. Scoped by user_email so one user can never mutate another's row, and
 * guarded to `is_workspace_admin = FALSE` so the workspace's own admin key can
 * never be disabled/deleted through this path. `status` drives disabled_at /
 * deleted_at: 'active' clears both, 'disabled' stamps disabled_at, 'deleted'
 * stamps deleted_at (the page filters status='deleted' rows out).
 */
export async function updateManagedApiKeyStatus(input: {
  email: string;
  fugueKeyId: string;
  status: "active" | "disabled" | "deleted";
}) {
  const now = new Date().toISOString();
  await withDbSchemaRetry(() =>
    queryDb(
      `
        UPDATE app_api_keys
        SET
          status = $3,
          disabled_at = CASE WHEN $3 = 'disabled' THEN $4::timestamptz ELSE NULL END,
          deleted_at = CASE WHEN $3 = 'deleted' THEN $4::timestamptz ELSE NULL END,
          last_synced_at = $4,
          updated_at = $4
        WHERE fugue_key_id = $1
          AND user_email = $2
          AND is_workspace_admin = FALSE
      `,
      [input.fugueKeyId, normalizeEmail(input.email), input.status, now],
    ),
  );
}

/**
 * Reflect an edited managed API key's label/scopes into the local mirror. Same
 * ownership + non-admin guards as updateManagedApiKeyStatus. Only provided
 * fields change; scopes replace the stored array (matching backend semantics).
 */
export async function updateManagedApiKeyMeta(input: {
  email: string;
  fugueKeyId: string;
  label?: string;
  scopes?: string[];
}) {
  const now = new Date().toISOString();
  await withDbSchemaRetry(() =>
    queryDb(
      `
        UPDATE app_api_keys
        SET
          label = COALESCE($3, label),
          scopes = COALESCE($4::jsonb, scopes),
          last_synced_at = $5,
          updated_at = $5
        WHERE fugue_key_id = $1
          AND user_email = $2
          AND is_workspace_admin = FALSE
      `,
      [
        input.fugueKeyId,
        normalizeEmail(input.email),
        input.label ?? null,
        input.scopes ? JSON.stringify(input.scopes) : null,
        now,
      ],
    ),
  );
}

/**
 * Fetch a single mirrored API key for authorization checks before a mutation.
 * Scoped by user_email so a caller can only ever see their own keys. Routes use
 * this to (a) confirm the key exists in the caller's workspace and (b) refuse to
 * touch the workspace admin key (is_workspace_admin) — which must never be
 * disabled/deleted/edited through the user-facing /keys controls, even though
 * the tenant-scoped admin key technically could via the control plane.
 */
export async function getManagedApiKeyForUser(email: string, fugueKeyId: string) {
  const result = await withDbSchemaRetry(() =>
    queryDb<{
      fugue_key_id: string;
      tenant_id: string;
      label: string;
      scopes: string[];
      status: "active" | "disabled" | "deleted";
      is_workspace_admin: boolean;
    }>(
      `
        SELECT fugue_key_id, tenant_id, label, scopes, status, is_workspace_admin
        FROM app_api_keys
        WHERE fugue_key_id = $1 AND user_email = $2
      `,
      [fugueKeyId, normalizeEmail(email)],
    ),
  );
  return result.rows[0] ?? null;
}

/* ---- node-enrollment keys (servers page) ---- */

/**
 * Persist a freshly-minted node-enrollment key into the local mirror the
 * /servers page reads. As with managed API keys, the secret is NOT stored
 * (secret_sealed = NULL): it is revealed once at creation for the join command
 * and never again. Marked source='managed', status='active'.
 */
export async function persistManagedNodeKey(input: {
  email: string;
  key: {
    id: string;
    tenantId: string;
    label: string;
    prefix: string | null;
    createdAt: string | null;
  };
}) {
  const now = new Date().toISOString();
  const createdAt = input.key.createdAt ?? now;

  await withDbSchemaRetry(() =>
    queryDb(
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
          $1, $2, $3, $4, $5,
          NULL, NULL, 'active', 'managed',
          NULL, NULL, $6, $7, $6
        )
        ON CONFLICT (fugue_node_key_id) DO UPDATE
        SET
          user_email = EXCLUDED.user_email,
          tenant_id = EXCLUDED.tenant_id,
          label = EXCLUDED.label,
          prefix = EXCLUDED.prefix,
          status = 'active',
          source = 'managed',
          revoked_at = NULL,
          last_synced_at = EXCLUDED.last_synced_at,
          updated_at = EXCLUDED.updated_at
      `,
      [
        input.key.id,
        normalizeEmail(input.email),
        input.key.tenantId,
        input.key.label,
        input.key.prefix,
        now,
        createdAt,
      ],
    ),
  );
}

/**
 * Reflect a revoked node key into the local mirror (status='revoked'). Scoped by
 * user_email so a caller can only revoke their own keys.
 */
export async function revokeManagedNodeKey(input: {
  email: string;
  nodeKeyId: string;
}) {
  const now = new Date().toISOString();
  await withDbSchemaRetry(() =>
    queryDb(
      `
        UPDATE app_node_keys
        SET status = 'revoked', revoked_at = $3, last_synced_at = $3, updated_at = $3
        WHERE fugue_node_key_id = $1 AND user_email = $2
      `,
      [input.nodeKeyId, normalizeEmail(input.email), now],
    ),
  );
}

/**
 * Rename a node key. This is LOCAL-only: the control plane has no node-key label
 * PATCH, so the display name is overridden via label_override in the mirror. The
 * /servers page prefers label_override over the synced label. Scoped by
 * user_email.
 */
export async function renameManagedNodeKey(input: {
  email: string;
  nodeKeyId: string;
  label: string;
}) {
  const now = new Date().toISOString();
  await withDbSchemaRetry(() =>
    queryDb(
      `
        UPDATE app_node_keys
        SET label_override = $3, updated_at = $4
        WHERE fugue_node_key_id = $1 AND user_email = $2
      `,
      [input.nodeKeyId, normalizeEmail(input.email), input.label, now],
    ),
  );
}

/** Fetch a single mirrored node key for authorization checks before a mutation. */
export async function getManagedNodeKeyForUser(email: string, nodeKeyId: string) {
  const result = await withDbSchemaRetry(() =>
    queryDb<{
      fugue_node_key_id: string;
      tenant_id: string;
      label: string;
      status: "active" | "revoked";
    }>(
      `
        SELECT fugue_node_key_id, tenant_id, label, status
        FROM app_node_keys
        WHERE fugue_node_key_id = $1 AND user_email = $2
      `,
      [nodeKeyId, normalizeEmail(email)],
    ),
  );
  return result.rows[0] ?? null;
}

export async function getWorkspaceSnapshotByEmail(email: string) {
  const row = await getWorkspaceRowByEmail(email);
  return row ? snapshotFromRow(row) : null;
}

export async function getWorkspaceSnapshotByTenantId(tenantId: string) {
  const row = await getWorkspaceRowByTenantId(tenantId);
  return row ? snapshotFromRow(row) : null;
}

export async function listWorkspaceSnapshots() {
  const result = await withDbSchemaRetry(() =>
    queryDb<WorkspaceRow>(
      `
        SELECT
          user_email,
          tenant_id,
          tenant_name,
          default_project_id,
          default_project_name,
          first_app_id,
          admin_key_id,
          admin_key_label,
          admin_key_prefix,
          admin_key_scopes,
          admin_key_secret_sealed,
          created_at,
          updated_at
        FROM app_workspaces
        ORDER BY created_at ASC, user_email ASC
      `,
    ),
  );

  return result.rows.map(snapshotFromRow);
}

export async function getWorkspaceSnapshotsByTenantIds(tenantIds: string[]) {
  const normalizedTenantIds = [
    ...new Set(
      tenantIds
        .map((tenantId) => tenantId.trim())
        .filter((tenantId) => tenantId.length > 0),
    ),
  ];

  if (!normalizedTenantIds.length) {
    return [] satisfies WorkspaceSnapshot[];
  }

  const result = await withDbSchemaRetry(() =>
    queryDb<WorkspaceRow>(
      `
        SELECT
          user_email,
          tenant_id,
          tenant_name,
          default_project_id,
          default_project_name,
          first_app_id,
          admin_key_id,
          admin_key_label,
          admin_key_prefix,
          admin_key_scopes,
          admin_key_secret_sealed,
          created_at,
          updated_at
        FROM app_workspaces
        WHERE tenant_id = ANY($1::text[])
        ORDER BY created_at ASC, user_email ASC
      `,
      [normalizedTenantIds],
    ),
  );

  return result.rows.map(snapshotFromRow);
}

export async function getWorkspaceSnapshotsByEmails(emails: string[]) {
  const normalizedEmails = [
    ...new Set(
      emails.map((email) => normalizeEmail(email)).filter((email) => email.length > 0),
    ),
  ];

  if (!normalizedEmails.length) {
    return [] satisfies WorkspaceSnapshot[];
  }

  const result = await withDbSchemaRetry(() =>
    queryDb<WorkspaceRow>(
      `
        SELECT
          user_email,
          tenant_id,
          tenant_name,
          default_project_id,
          default_project_name,
          first_app_id,
          admin_key_id,
          admin_key_label,
          admin_key_prefix,
          admin_key_scopes,
          admin_key_secret_sealed,
          created_at,
          updated_at
        FROM app_workspaces
        WHERE user_email = ANY($1::text[])
        ORDER BY created_at ASC, user_email ASC
      `,
      [normalizedEmails],
    ),
  );

  return result.rows.map(snapshotFromRow);
}

export async function getWorkspaceAccessByEmail(email: string) {
  const row = await getWorkspaceRowByEmail(email);
  return row ? accessFromRow(row) : null;
}

export async function getWorkspaceBootstrapStateByEmail(email: string) {
  const row = await getWorkspaceRowByEmail(email);
  return row ? bootstrapStateFromRow(row) : null;
}

export async function saveWorkspaceAccess(record: WorkspaceAccess) {
  await ensureDbSchema();

  const normalizedEmail = normalizeEmail(record.email);
  const createdAt = readTimestamp(record.createdAt);
  const updatedAt = readTimestamp(record.updatedAt);

  return withDbTransaction(async (client) => {
    await ensureUserStub(client, normalizedEmail);

    const result = await client.query<WorkspaceRow>(
      `
        INSERT INTO app_workspaces (
          user_email,
          tenant_id,
          tenant_name,
          default_project_id,
          default_project_name,
          first_app_id,
          admin_key_id,
          admin_key_label,
          admin_key_prefix,
          admin_key_scopes,
          admin_key_secret_sealed,
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
          $10::jsonb,
          $11,
          $12,
          $13
        )
        ON CONFLICT (user_email) DO UPDATE
        SET
          tenant_id = EXCLUDED.tenant_id,
          tenant_name = EXCLUDED.tenant_name,
          default_project_id = EXCLUDED.default_project_id,
          default_project_name = EXCLUDED.default_project_name,
          first_app_id = EXCLUDED.first_app_id,
          admin_key_id = EXCLUDED.admin_key_id,
          admin_key_label = EXCLUDED.admin_key_label,
          admin_key_prefix = EXCLUDED.admin_key_prefix,
          admin_key_scopes = EXCLUDED.admin_key_scopes,
          admin_key_secret_sealed = EXCLUDED.admin_key_secret_sealed,
          updated_at = EXCLUDED.updated_at
        RETURNING
          user_email,
          tenant_id,
          tenant_name,
          default_project_id,
          default_project_name,
          first_app_id,
          admin_key_id,
          admin_key_label,
          admin_key_prefix,
          admin_key_scopes,
          admin_key_secret_sealed,
          created_at,
          updated_at
      `,
      [
        normalizedEmail,
        record.tenantId,
        record.tenantName,
        record.defaultProjectId,
        record.defaultProjectName,
        record.firstAppId,
        record.adminKeyId,
        record.adminKeyLabel,
        record.adminKeyPrefix,
        JSON.stringify(record.adminKeyScopes),
        sealText(record.adminKeySecret),
        createdAt,
        updatedAt,
      ],
    );

    await upsertWorkspaceAdminKey(client, {
      ...record,
      createdAt,
      email: normalizedEmail,
      updatedAt,
    });

    return snapshotFromRow(
      requireQueryRow(result.rows[0], "Provisioning a Fugue workspace"),
    );
  });
}
