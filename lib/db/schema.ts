import "server-only";

import { queryDb } from "@/lib/db/pool";

declare global {
  var __fugueDbSchemaPromise: Promise<void> | undefined;
  var __fugueDbSchemaVersion: string | undefined;
}

const SCHEMA_VERSION = "2026-03-25-node-keys";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS app_users (
  email TEXT PRIMARY KEY,
  name TEXT,
  picture_url TEXT,
  provider TEXT NOT NULL,
  provider_id TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS app_workspaces (
  user_email TEXT PRIMARY KEY REFERENCES app_users(email) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL UNIQUE,
  tenant_name TEXT NOT NULL,
  default_project_id TEXT,
  default_project_name TEXT,
  first_app_id TEXT,
  admin_key_id TEXT NOT NULL,
  admin_key_label TEXT NOT NULL,
  admin_key_prefix TEXT,
  admin_key_scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  admin_key_secret_sealed TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_api_keys (
  fugue_key_id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL REFERENCES app_users(email) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  label TEXT NOT NULL,
  prefix TEXT,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  secret_sealed TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT NOT NULL DEFAULT 'external',
  is_workspace_admin BOOLEAN NOT NULL DEFAULT FALSE,
  last_used_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_api_keys_status_check CHECK (status IN ('active', 'disabled', 'deleted')),
  CONSTRAINT app_api_keys_source_check CHECK (source IN ('workspace-admin', 'managed', 'external'))
);

CREATE TABLE IF NOT EXISTS app_node_keys (
  fugue_node_key_id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL REFERENCES app_users(email) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  label TEXT NOT NULL,
  prefix TEXT,
  hash TEXT,
  secret_sealed TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT NOT NULL DEFAULT 'external',
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_node_keys_status_check CHECK (status IN ('active', 'revoked')),
  CONSTRAINT app_node_keys_source_check CHECK (source IN ('managed', 'external'))
);

CREATE INDEX IF NOT EXISTS idx_app_workspaces_tenant_id
  ON app_workspaces (tenant_id);

CREATE INDEX IF NOT EXISTS idx_app_users_status
  ON app_users (status);

CREATE INDEX IF NOT EXISTS idx_app_api_keys_user_email
  ON app_api_keys (user_email);

CREATE INDEX IF NOT EXISTS idx_app_api_keys_tenant_id
  ON app_api_keys (tenant_id);

CREATE INDEX IF NOT EXISTS idx_app_api_keys_status
  ON app_api_keys (status);

CREATE INDEX IF NOT EXISTS idx_app_node_keys_user_email
  ON app_node_keys (user_email);

CREATE INDEX IF NOT EXISTS idx_app_node_keys_tenant_id
  ON app_node_keys (tenant_id);

CREATE INDEX IF NOT EXISTS idx_app_node_keys_status
  ON app_node_keys (status);

UPDATE app_users
SET is_admin = TRUE
WHERE email = (
  SELECT email
  FROM app_users
  WHERE status <> 'deleted'
  ORDER BY created_at ASC, email ASC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1
  FROM app_users
  WHERE is_admin = TRUE
    AND status <> 'deleted'
);
`;

async function initSchema() {
  await queryDb(SCHEMA_SQL);
}

export async function ensureDbSchema() {
  if (
    !globalThis.__fugueDbSchemaPromise ||
    globalThis.__fugueDbSchemaVersion !== SCHEMA_VERSION
  ) {
    globalThis.__fugueDbSchemaVersion = SCHEMA_VERSION;
    globalThis.__fugueDbSchemaPromise = initSchema();
  }

  try {
    await globalThis.__fugueDbSchemaPromise;
  } catch (error) {
    globalThis.__fugueDbSchemaPromise = undefined;
    globalThis.__fugueDbSchemaVersion = undefined;
    throw error;
  }
}
