import "server-only";

import { queryDb } from "@/lib/db/pool";

declare global {
  var __fugueDbSchemaPromise: Promise<void> | undefined;
}

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

CREATE INDEX IF NOT EXISTS idx_app_workspaces_tenant_id
  ON app_workspaces (tenant_id);

CREATE INDEX IF NOT EXISTS idx_app_api_keys_user_email
  ON app_api_keys (user_email);

CREATE INDEX IF NOT EXISTS idx_app_api_keys_tenant_id
  ON app_api_keys (tenant_id);

CREATE INDEX IF NOT EXISTS idx_app_api_keys_status
  ON app_api_keys (status);
`;

async function initSchema() {
  await queryDb(SCHEMA_SQL);
}

export async function ensureDbSchema() {
  if (!globalThis.__fugueDbSchemaPromise) {
    globalThis.__fugueDbSchemaPromise = initSchema();
  }

  try {
    await globalThis.__fugueDbSchemaPromise;
  } catch (error) {
    globalThis.__fugueDbSchemaPromise = undefined;
    throw error;
  }
}
