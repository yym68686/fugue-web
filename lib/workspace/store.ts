import "server-only";

import type { PoolClient } from "pg";

import { ensureAppUserRecord } from "@/lib/app-users/store";
import type { SessionUser } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/validation";
import { ensureDbSchema } from "@/lib/db/schema";
import { queryDb, withDbTransaction } from "@/lib/db/pool";
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
  await ensureDbSchema();

  const normalizedEmail = normalizeEmail(email);
  const result = await queryDb<WorkspaceRow>(
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
  );

  return result.rows[0] ?? null;
}

async function getWorkspaceRowByTenantId(tenantId: string) {
  await ensureDbSchema();

  const result = await queryDb<WorkspaceRow>(
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

async function demotePreviousWorkspaceAdminKeys(
  client: PoolClient,
  record: WorkspaceAccess,
) {
  await client.query(
    `
      UPDATE app_api_keys
      SET
        source = CASE
          WHEN source = 'workspace-admin'
            THEN 'external'
          ELSE source
        END,
        is_workspace_admin = FALSE,
        secret_sealed = NULL,
        updated_at = $4
      WHERE user_email = $1
        AND tenant_id = $2
        AND fugue_key_id <> $3
        AND is_workspace_admin = TRUE
    `,
    [
      normalizeEmail(record.email),
      record.tenantId,
      record.adminKeyId,
      record.updatedAt,
    ],
  );
}

export async function ensureAppUser(user: SessionUser) {
  return ensureAppUserRecord(user);
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
  await ensureDbSchema();

  const result = await queryDb<WorkspaceRow>(
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
    await demotePreviousWorkspaceAdminKeys(client, {
      ...record,
      createdAt,
      email: normalizedEmail,
      updatedAt,
    });

    return snapshotFromRow(result.rows[0]);
  });
}
