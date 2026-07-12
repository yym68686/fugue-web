import "server-only";

import { queryDb } from "@/lib/db/pool";

declare global {
  var __fugueDbSchemaPromise: Promise<void> | undefined;
  var __fugueDbSchemaVersion: string | undefined;
}

const SCHEMA_VERSION = "2026-07-12-bounded-admin-pagination";

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

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS session_version BIGINT NOT NULL DEFAULT 1;

-- Fail closed if an older application binary is rolled back after this
-- migration. Admin grants must opt in inside the same database transaction;
-- the retired "first user" code has no such opt-in and is rejected.
CREATE OR REPLACE FUNCTION guard_app_user_admin_promotion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_admin = TRUE AND
       current_setting('fugue.allow_admin_promotion', TRUE) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'admin promotion requires an explicit privileged transaction'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.is_admin = TRUE AND OLD.is_admin = FALSE AND
        current_setting('fugue.allow_admin_promotion', TRUE) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'admin promotion requires an explicit privileged transaction'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  CREATE TRIGGER trg_guard_app_user_admin_promotion
  BEFORE INSERT OR UPDATE OF is_admin ON app_users
  FOR EACH ROW
  EXECUTE FUNCTION guard_app_user_admin_promotion();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

CREATE TABLE IF NOT EXISTS app_admin_bootstrap_state (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  admin_email TEXT,
  completed_at TIMESTAMPTZ,
  bootstrap_version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_admin_bootstrap_state_singleton_check CHECK (singleton = TRUE),
  CONSTRAINT app_admin_bootstrap_state_completion_check CHECK (
    (completed = FALSE AND completed_at IS NULL) OR
    (completed = TRUE AND completed_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS app_security_audit_events (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  actor_email TEXT,
  target_email TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Existing installations may already have an explicitly assigned admin. Mark
-- that installation as complete once so the new one-time bootstrap path can
-- never grant a second bootstrap role after an application rollback/redeploy.
INSERT INTO app_admin_bootstrap_state (
  singleton,
  completed,
  admin_email,
  completed_at,
  bootstrap_version,
  updated_at
)
SELECT
  TRUE,
  TRUE,
  email,
  NOW(),
  1,
  NOW()
FROM app_users
WHERE is_admin = TRUE
  AND status <> 'deleted'
ORDER BY created_at ASC, email ASC
LIMIT 1
ON CONFLICT (singleton) DO NOTHING;

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

CREATE TABLE IF NOT EXISTS app_auth_oauth_transactions (
  id TEXT PRIMARY KEY,
  flow TEXT NOT NULL,
  nonce_hash TEXT NOT NULL,
  pkce_verifier_sealed TEXT NOT NULL,
  origin TEXT NOT NULL,
  return_to TEXT NOT NULL,
  subject_email TEXT,
  mode TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  CONSTRAINT app_auth_oauth_transactions_flow_check CHECK (
    flow IN (
      'google-signin',
      'github-signin',
      'google-link',
      'github-link',
      'github-connect'
    )
  ),
  CONSTRAINT app_auth_oauth_transactions_mode_check CHECK (
    mode IS NULL OR mode IN ('signin', 'signup')
  )
);

CREATE TABLE IF NOT EXISTS app_auth_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  window_seconds INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_auth_rate_limits_window_check CHECK (window_seconds > 0),
  CONSTRAINT app_auth_rate_limits_count_check CHECK (attempt_count >= 0)
);

CREATE TABLE IF NOT EXISTS app_auth_consumed_handoffs (
  id TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

CREATE TABLE IF NOT EXISTS app_github_app_image_links (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL REFERENCES app_users(email) ON DELETE CASCADE,
  fugue_project_id TEXT NOT NULL DEFAULT '',
  fugue_app_id TEXT NOT NULL,
  image_ref TEXT NOT NULL,
  github_repo TEXT NOT NULL,
  github_workflow TEXT NOT NULL DEFAULT '',
  github_package TEXT NOT NULL DEFAULT '',
  github_installation_id TEXT NOT NULL DEFAULT '',
  github_last_webhook_delivery_id TEXT NOT NULL DEFAULT '',
  github_last_webhook_event_name TEXT NOT NULL DEFAULT '',
  github_last_webhook_received_at TIMESTAMPTZ,
  github_last_image_sync_at TIMESTAMPTZ,
  github_last_image_sync_delivery_id TEXT NOT NULL DEFAULT '',
  github_last_image_sync_error TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_github_app_image_links
  ADD COLUMN IF NOT EXISTS fugue_project_id TEXT NOT NULL DEFAULT '';

ALTER TABLE app_github_app_image_links
  ADD COLUMN IF NOT EXISTS github_workflow TEXT NOT NULL DEFAULT '';

ALTER TABLE app_github_app_image_links
  ADD COLUMN IF NOT EXISTS github_package TEXT NOT NULL DEFAULT '';

ALTER TABLE app_github_app_image_links
  ADD COLUMN IF NOT EXISTS github_installation_id TEXT NOT NULL DEFAULT '';

ALTER TABLE app_github_app_image_links
  ADD COLUMN IF NOT EXISTS github_last_webhook_delivery_id TEXT NOT NULL DEFAULT '';

ALTER TABLE app_github_app_image_links
  ADD COLUMN IF NOT EXISTS github_last_webhook_event_name TEXT NOT NULL DEFAULT '';

ALTER TABLE app_github_app_image_links
  ADD COLUMN IF NOT EXISTS github_last_webhook_received_at TIMESTAMPTZ;

ALTER TABLE app_github_app_image_links
  ADD COLUMN IF NOT EXISTS github_last_image_sync_at TIMESTAMPTZ;

ALTER TABLE app_github_app_image_links
  ADD COLUMN IF NOT EXISTS github_last_image_sync_delivery_id TEXT NOT NULL DEFAULT '';

ALTER TABLE app_github_app_image_links
  ADD COLUMN IF NOT EXISTS github_last_image_sync_error TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS app_github_repo_installations (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL REFERENCES app_users(email) ON DELETE CASCADE,
  github_repo TEXT NOT NULL,
  github_installation_id TEXT NOT NULL,
  github_account_login TEXT NOT NULL DEFAULT '',
  github_repository_selection TEXT NOT NULL DEFAULT '',
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_github_project_image_links (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL REFERENCES app_users(email) ON DELETE CASCADE,
  fugue_project_id TEXT NOT NULL,
  github_repo TEXT NOT NULL,
  github_installation_id TEXT NOT NULL DEFAULT '',
  github_last_webhook_delivery_id TEXT NOT NULL DEFAULT '',
  github_last_webhook_event_name TEXT NOT NULL DEFAULT '',
  github_last_webhook_received_at TIMESTAMPTZ,
  github_last_image_sync_at TIMESTAMPTZ,
  github_last_image_sync_delivery_id TEXT NOT NULL DEFAULT '',
  github_last_image_sync_error TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_github_project_image_links
  ADD COLUMN IF NOT EXISTS github_installation_id TEXT NOT NULL DEFAULT '';

ALTER TABLE app_github_project_image_links
  ADD COLUMN IF NOT EXISTS github_last_webhook_delivery_id TEXT NOT NULL DEFAULT '';

ALTER TABLE app_github_project_image_links
  ADD COLUMN IF NOT EXISTS github_last_webhook_event_name TEXT NOT NULL DEFAULT '';

ALTER TABLE app_github_project_image_links
  ADD COLUMN IF NOT EXISTS github_last_webhook_received_at TIMESTAMPTZ;

ALTER TABLE app_github_project_image_links
  ADD COLUMN IF NOT EXISTS github_last_image_sync_at TIMESTAMPTZ;

ALTER TABLE app_github_project_image_links
  ADD COLUMN IF NOT EXISTS github_last_image_sync_delivery_id TEXT NOT NULL DEFAULT '';

ALTER TABLE app_github_project_image_links
  ADD COLUMN IF NOT EXISTS github_last_image_sync_error TEXT NOT NULL DEFAULT '';

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

CREATE TABLE IF NOT EXISTS app_admin_snapshots (
  key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_workspaces_tenant_id
  ON app_workspaces (tenant_id);

CREATE INDEX IF NOT EXISTS idx_app_users_status
  ON app_users (status);

CREATE INDEX IF NOT EXISTS idx_app_users_admin_status_activity_email
  ON app_users (
    (CASE WHEN is_admin THEN 0 ELSE 1 END),
    (CASE status WHEN 'active' THEN 0 WHEN 'blocked' THEN 1 ELSE 2 END),
    (COALESCE(last_login_at, created_at)) DESC,
    email ASC
  );

CREATE INDEX IF NOT EXISTS idx_app_auth_methods_user_email
  ON app_auth_methods (user_email, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_auth_methods_method_provider_id
  ON app_auth_methods (method, provider_id)
  WHERE provider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_auth_oauth_transactions_expires_at
  ON app_auth_oauth_transactions (expires_at);

CREATE INDEX IF NOT EXISTS idx_app_auth_oauth_transactions_active
  ON app_auth_oauth_transactions (flow, expires_at)
  WHERE consumed_at IS NULL AND failed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_app_auth_rate_limits_updated_at
  ON app_auth_rate_limits (updated_at);

CREATE INDEX IF NOT EXISTS idx_app_auth_consumed_handoffs_expires_at
  ON app_auth_consumed_handoffs (expires_at);

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_github_repo_installations_unique_repo
  ON app_github_repo_installations (user_email, github_repo);

CREATE INDEX IF NOT EXISTS idx_app_github_repo_installations_installation
  ON app_github_repo_installations (github_installation_id, github_repo);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_github_app_image_links_unique_app
  ON app_github_app_image_links (user_email, fugue_app_id);

CREATE INDEX IF NOT EXISTS idx_app_github_app_image_links_project
  ON app_github_app_image_links (user_email, fugue_project_id);

CREATE INDEX IF NOT EXISTS idx_app_github_app_image_links_repo
  ON app_github_app_image_links (github_repo, enabled);

CREATE INDEX IF NOT EXISTS idx_app_github_app_image_links_installation
  ON app_github_app_image_links (github_installation_id, enabled);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_github_project_image_links_unique_project
  ON app_github_project_image_links (user_email, fugue_project_id);

CREATE INDEX IF NOT EXISTS idx_app_github_project_image_links_repo
  ON app_github_project_image_links (github_repo, enabled);

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

CREATE INDEX IF NOT EXISTS idx_app_admin_snapshots_updated_at
  ON app_admin_snapshots (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_security_audit_events_target
  ON app_security_audit_events (target_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_security_audit_events_action
  ON app_security_audit_events (action, created_at DESC);
`;

async function initSchema() {
  await queryDb(SCHEMA_SQL);
}

function isRetryableSchemaReadError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  const code = (error as { code?: string }).code;

  return code === "42P01" || code === "42703";
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

export async function withDbSchemaRetry<T>(run: () => Promise<T>) {
  try {
    return await run();
  } catch (error) {
    if (!isRetryableSchemaReadError(error)) {
      throw error;
    }

    await ensureDbSchema();
    return run();
  }
}
