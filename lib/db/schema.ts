import "server-only";

import { queryDb } from "@/lib/db/pool";

declare global {
  var __fugueDbSchemaPromise: Promise<void> | undefined;
  var __fugueDbSchemaVersion: string | undefined;
}

const SCHEMA_VERSION = "2026-04-07-auth-profile-methods";

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

CREATE TABLE IF NOT EXISTS app_auth_methods (
  user_email TEXT NOT NULL REFERENCES app_users(email) ON DELETE CASCADE,
  method TEXT NOT NULL,
  provider_id TEXT,
  provider_label TEXT,
  secret_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_email, method),
  CONSTRAINT app_auth_methods_method_check CHECK (
    method IN ('email_link', 'password', 'google', 'github')
  )
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

ALTER TABLE app_node_keys
  ADD COLUMN IF NOT EXISTS label_override TEXT;

CREATE TABLE IF NOT EXISTS app_github_connections (
  user_email TEXT PRIMARY KEY REFERENCES app_users(email) ON DELETE CASCADE,
  github_user_id TEXT NOT NULL,
  github_login TEXT NOT NULL,
  github_name TEXT,
  github_avatar_url TEXT,
  github_scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  access_token_sealed TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_billing_topups (
  request_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'creem',
  user_email TEXT NOT NULL REFERENCES app_users(email) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  product_id TEXT,
  units INTEGER NOT NULL DEFAULT 0,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  checkout_id TEXT UNIQUE,
  order_id TEXT UNIQUE,
  currency TEXT,
  payer_email TEXT,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_billing_topups_status_check CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  )
);

CREATE TABLE IF NOT EXISTS app_creem_events (
  creem_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  request_id TEXT,
  user_email TEXT REFERENCES app_users(email) ON DELETE SET NULL,
  tenant_id TEXT,
  amount_cents INTEGER,
  currency TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_workspaces_tenant_id
  ON app_workspaces (tenant_id);

CREATE INDEX IF NOT EXISTS idx_app_users_status
  ON app_users (status);

CREATE INDEX IF NOT EXISTS idx_app_auth_methods_user_email
  ON app_auth_methods (user_email, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_auth_methods_method_provider_id
  ON app_auth_methods (method, provider_id)
  WHERE provider_id IS NOT NULL;

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

CREATE INDEX IF NOT EXISTS idx_app_github_connections_github_user_id
  ON app_github_connections (github_user_id);

CREATE INDEX IF NOT EXISTS idx_app_billing_topups_user_email
  ON app_billing_topups (user_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_billing_topups_tenant_id
  ON app_billing_topups (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_billing_topups_status
  ON app_billing_topups (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_creem_events_request_id
  ON app_creem_events (request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_creem_events_user_email
  ON app_creem_events (user_email, created_at DESC);

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
