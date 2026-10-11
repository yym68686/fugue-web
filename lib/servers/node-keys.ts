import "server-only";
import { queryDb } from "@/lib/db/pool";
import { normalizeEmail } from "@/lib/auth/validation";
import { unsealText } from "@/lib/security/seal";
import type { FugueNodeKey } from "@/lib/fugue/console";

export async function syncNodeKeyMetadata(
  email: string,
  tenantId: string,
  keys: FugueNodeKey[],
) {
  // Update existing mirrors only. A refresh cannot resurrect a key deliberately
  // deleted from the console, even when a concurrent fetch saw it before revoke.
  const records = keys
    .filter(
      (k) =>
        k.tenant_id === tenantId &&
        ["active", "revoked"].includes(k.status ?? ""),
    )
    .map((k) => ({
      id: k.id,
      label: k.label,
      prefix: k.prefix,
      status: k.status,
      last_used_at: k.last_used_at,
      revoked_at: k.revoked_at,
    }));
  await queryDb(
    `UPDATE app_node_keys AS local
    SET label = upstream.label, prefix = upstream.prefix,
        status = CASE WHEN local.status = 'revoked' THEN 'revoked' ELSE upstream.status END,
        secret_sealed = CASE WHEN upstream.status = 'revoked' THEN NULL ELSE local.secret_sealed END,
        last_used_at = GREATEST(local.last_used_at, upstream.last_used_at), revoked_at = COALESCE(upstream.revoked_at, local.revoked_at),
        last_synced_at = NOW(), updated_at = NOW()
    FROM jsonb_to_recordset($3::jsonb) AS upstream(id text, label text, prefix text, status text, last_used_at timestamptz, revoked_at timestamptz)
    WHERE local.fugue_node_key_id = upstream.id AND local.user_email = $1 AND local.tenant_id = $2`,
    [normalizeEmail(email), tenantId, JSON.stringify(records)],
  );
}

export async function readNodeKeyMetadata(email: string, tenantId: string) {
  const result = await queryDb<{
    id: string;
    label: string;
    prefix: string | null;
    status: "active" | "revoked";
    last_used_at: Date | string | null;
    created_at: Date | string | null;
    has_secret: boolean;
  }>(
    `SELECT fugue_node_key_id AS id, COALESCE(label_override, label) AS label, prefix,
    status, last_used_at, created_at, (secret_sealed IS NOT NULL) AS has_secret
    FROM app_node_keys WHERE user_email = $1 AND tenant_id = $2 ORDER BY created_at DESC`,
    [normalizeEmail(email), tenantId],
  );
  return result.rows;
}

export async function readNodeKeySecret(
  email: string,
  tenantId: string,
  id: string,
) {
  const result = await queryDb<{ secret_sealed: string | null }>(
    `SELECT secret_sealed FROM app_node_keys WHERE fugue_node_key_id = $1 AND user_email = $2 AND tenant_id = $3 AND status = 'active'`,
    [id, normalizeEmail(email), tenantId],
  );
  const row = result.rows[0];
  return {
    found: Boolean(row),
    secret: row?.secret_sealed ? unsealText(row.secret_sealed) : null,
  };
}

/** Explicit rename of a backend-authorized key may create its metadata mirror. */
export async function renameExternalNodeKey(
  email: string,
  tenantId: string,
  id: string,
  label: string,
) {
  await queryDb(
    `INSERT INTO app_node_keys (fugue_node_key_id, user_email, tenant_id, label, label_override, status, source)
    VALUES ($1, $2, $3, $4, $4, 'active', 'external')
    ON CONFLICT (fugue_node_key_id) DO UPDATE SET label_override = $4, updated_at = NOW()
    WHERE app_node_keys.user_email = $2 AND app_node_keys.tenant_id = $3`,
    [id, normalizeEmail(email), tenantId, label],
  );
}
