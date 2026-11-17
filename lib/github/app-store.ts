import "server-only";
import { randomUUID } from "node:crypto";
import { queryDb, withDbTransaction } from "@/lib/db/pool";
import { ensureDbSchema } from "@/lib/db/schema";
import { normalizeEmail } from "@/lib/auth/validation";
import type { GitHubImageEvent, GitHubImageLink, GitHubImageJob } from "./app-types";

declare global { var __fugueGitHubAppSchema: Promise<void> | undefined; }

// Additive and separately initialized: restoring this feature must not block
// existing console/auth routes or change any tenant's deployment configuration.
const SCHEMA = `
ALTER TABLE app_github_app_image_links ADD COLUMN IF NOT EXISTS github_branch TEXT NOT NULL DEFAULT 'main';
ALTER TABLE app_github_app_image_links ADD COLUMN IF NOT EXISTS github_binding_revision TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS app_github_webhook_deliveries (
  id TEXT PRIMARY KEY, event_name TEXT NOT NULL, payload_sha256 TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_app_github_webhook_deliveries_received ON app_github_webhook_deliveries(received_at);
CREATE TABLE IF NOT EXISTS app_github_webhook_jobs (
  id TEXT PRIMARY KEY, delivery_id TEXT NOT NULL REFERENCES app_github_webhook_deliveries(id) ON DELETE CASCADE,
  link_id TEXT NOT NULL REFERENCES app_github_app_image_links(id) ON DELETE CASCADE,
  binding_revision TEXT NOT NULL, event_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), lease_until TIMESTAMPTZ,
  operation_id TEXT NOT NULL DEFAULT '', last_error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(delivery_id, link_id)
);
CREATE INDEX IF NOT EXISTS idx_app_github_webhook_jobs_due ON app_github_webhook_jobs(next_attempt_at, lease_until)
  WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_app_github_webhook_jobs_link ON app_github_webhook_jobs(link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_github_webhook_jobs_finished ON app_github_webhook_jobs(updated_at)
  WHERE status IN ('completed','cancelled','failed');
CREATE TABLE IF NOT EXISTS app_github_install_consumed_states (
  id TEXT PRIMARY KEY, consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_app_github_install_states_consumed ON app_github_install_consumed_states(consumed_at);`;

export async function ensureGitHubAppSchema() {
  if (!globalThis.__fugueGitHubAppSchema) {
    globalThis.__fugueGitHubAppSchema = (async () => {
      await ensureDbSchema();
      await queryDb(SCHEMA);
    })().catch((error) => { globalThis.__fugueGitHubAppSchema = undefined; throw error; });
  }
  await globalThis.__fugueGitHubAppSchema;
}

type LinkRow = {
  id: string; user_email: string; fugue_app_id: string; github_repo: string;
  github_installation_id: string; github_workflow: string; github_branch: string;
  github_package: string; github_binding_revision: string; image_ref: string; enabled: boolean;
  github_last_webhook_received_at: Date | string | null;
  github_last_image_sync_at: Date | string | null; github_last_image_sync_error: string;
};

function timestamp(value: Date | string | null) { return value ? new Date(value).toISOString() : null; }
function publicLink(row: LinkRow): GitHubImageLink {
  return {
    id: row.id, fugueAppId: row.fugue_app_id, githubRepo: row.github_repo,
    githubInstallationId: row.github_installation_id, githubWorkflow: row.github_workflow,
    githubBranch: row.github_branch, githubPackage: row.github_package, imageRef: row.image_ref,
    enabled: row.enabled && Boolean(row.github_binding_revision), lastWebhookReceivedAt: timestamp(row.github_last_webhook_received_at),
    lastImageSyncAt: timestamp(row.github_last_image_sync_at), lastImageSyncError: row.github_last_image_sync_error,
  };
}

export async function getGitHubImageLink(email: string, appId: string) {
  await ensureGitHubAppSchema();
  const rows = await queryDb<LinkRow>("SELECT * FROM app_github_app_image_links WHERE user_email = $1 AND fugue_app_id = $2", [normalizeEmail(email), appId]);
  return rows.rows[0] ? publicLink(rows.rows[0]) : null;
}

export async function listGitHubImageJobs(email: string, appId: string): Promise<GitHubImageJob[]> {
  await ensureGitHubAppSchema();
  const rows = await queryDb<{ delivery_id: string; event_name: string; status: string; attempts: number; operation_id: string; last_error: string; updated_at: Date }>(`
    SELECT j.delivery_id, j.event_name, j.status, j.attempts, j.operation_id, j.last_error, j.updated_at
    FROM app_github_webhook_jobs j JOIN app_github_app_image_links l ON l.id = j.link_id
    WHERE l.user_email = $1 AND l.fugue_app_id = $2 ORDER BY j.created_at DESC LIMIT 10`, [normalizeEmail(email), appId]);
  return rows.rows.map((row) => ({ deliveryId: row.delivery_id, eventName: row.event_name, status: row.status, attempts: row.attempts,
    operationId: row.operation_id, lastError: row.last_error, updatedAt: timestamp(row.updated_at)! }));
}

export async function saveGitHubImageLink(input: {
  email: string; appId: string; projectId: string; repo: string; installationId: string;
  workflow: string; branch: string; packageName: string; imageRef: string;
  accountLogin: string; repositorySelection: string;
}) {
  await ensureGitHubAppSchema();
  const email = normalizeEmail(input.email);
  await withDbTransaction(async (client) => {
    await client.query(`INSERT INTO app_github_repo_installations
      (id, user_email, github_repo, github_installation_id, github_account_login, github_repository_selection, verified)
      VALUES ($1,$2,$3,$4,$5,$6,TRUE) ON CONFLICT (user_email, github_repo) DO UPDATE SET
      github_installation_id = EXCLUDED.github_installation_id, github_account_login = EXCLUDED.github_account_login,
      github_repository_selection = EXCLUDED.github_repository_selection, verified = TRUE, updated_at = NOW()`,
    [randomUUID(), email, input.repo, input.installationId, input.accountLogin, input.repositorySelection]);
    await client.query(`INSERT INTO app_github_app_image_links
      (id,user_email,fugue_app_id,fugue_project_id,github_repo,github_installation_id,github_workflow,github_branch,github_package,image_ref,github_binding_revision,enabled)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE) ON CONFLICT (user_email, fugue_app_id) DO UPDATE SET
      fugue_project_id = EXCLUDED.fugue_project_id, github_repo = EXCLUDED.github_repo,
      github_installation_id = EXCLUDED.github_installation_id, github_workflow = EXCLUDED.github_workflow,
      github_branch = EXCLUDED.github_branch, github_package = EXCLUDED.github_package, image_ref = EXCLUDED.image_ref,
      github_binding_revision = EXCLUDED.github_binding_revision, enabled = TRUE, github_last_image_sync_error = '', updated_at = NOW()`,
    [randomUUID(), email, input.appId, input.projectId, input.repo, input.installationId, input.workflow, input.branch, input.packageName, input.imageRef, randomUUID()]);
  });
  return getGitHubImageLink(email, input.appId);
}

export async function disableGitHubImageLink(email: string, appId: string) {
  await ensureGitHubAppSchema();
  await queryDb("UPDATE app_github_app_image_links SET enabled = FALSE, github_binding_revision = $3, updated_at = NOW() WHERE user_email = $1 AND fugue_app_id = $2", [normalizeEmail(email), appId, randomUUID()]);
}

export async function consumeGitHubInstallState(id: string) {
  await ensureGitHubAppSchema();
  const row = await queryDb("INSERT INTO app_github_install_consumed_states(id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id", [id]);
  return row.rows.length === 1;
}

export async function recordVerifiedGitHubInstallation(email: string, repo: string, installation: { id: string; accountLogin: string; repositorySelection: string }) {
  await ensureGitHubAppSchema();
  await queryDb(`INSERT INTO app_github_repo_installations
    (id,user_email,github_repo,github_installation_id,github_account_login,github_repository_selection,verified)
    VALUES ($1,$2,$3,$4,$5,$6,TRUE) ON CONFLICT (user_email,github_repo) DO UPDATE SET
    github_installation_id = EXCLUDED.github_installation_id, github_account_login = EXCLUDED.github_account_login,
    github_repository_selection = EXCLUDED.github_repository_selection, verified = TRUE, updated_at = NOW()`,
  [randomUUID(), normalizeEmail(email), repo, installation.id, installation.accountLogin, installation.repositorySelection]);
}

export async function enqueueGitHubImageEvent(event: GitHubImageEvent, payloadHash: string) {
  await ensureGitHubAppSchema();
  return withDbTransaction(async (client) => {
    const inserted = await client.query("INSERT INTO app_github_webhook_deliveries(id,event_name,payload_sha256) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id", [event.deliveryId, event.eventName, payloadHash]);
    if (!inserted.rows.length) {
      const existing = await client.query("SELECT event_name, payload_sha256 FROM app_github_webhook_deliveries WHERE id = $1", [event.deliveryId]);
      if (existing.rows[0]?.event_name !== event.eventName || existing.rows[0]?.payload_sha256 !== payloadHash) throw new Error("409 GitHub delivery ID was already used with a different payload.");
      return { duplicate: true, queued: 0 };
    }
    const jobs = await client.query(`INSERT INTO app_github_webhook_jobs(id,delivery_id,link_id,binding_revision,event_name)
      SELECT $1 || ':' || l.id, $1, l.id, l.github_binding_revision, $2 FROM app_github_app_image_links l
      JOIN app_github_repo_installations i ON i.user_email = l.user_email AND i.github_repo = l.github_repo
        AND i.github_installation_id = l.github_installation_id AND i.verified = TRUE
      JOIN app_users u ON u.email = l.user_email AND u.status = 'active'
      WHERE l.enabled = TRUE AND l.github_binding_revision <> '' AND l.github_repo = $3 AND l.github_installation_id = $4
        AND (l.github_workflow = '' OR l.github_workflow IN ($5,$6))
        AND (l.github_branch = '' OR l.github_branch = $7)
        AND (l.github_package = '' OR l.github_package = $8)
        AND ($2 = 'workflow_run' OR (l.github_package <> '' AND l.github_workflow = '' AND l.github_branch = ''))
      ON CONFLICT DO NOTHING RETURNING link_id`,
    [event.deliveryId, event.eventName, event.repo, event.installationId, event.workflow, event.workflowPath, event.branch, event.packageName]);
    if (jobs.rows.length) await client.query(`UPDATE app_github_app_image_links SET
      github_last_webhook_delivery_id = $1, github_last_webhook_event_name = $2, github_last_webhook_received_at = NOW()
      WHERE id = ANY($3::text[])`, [event.deliveryId, event.eventName, jobs.rows.map((row) => row.link_id)]);
    return { duplicate: false, queued: jobs.rows.length };
  });
}

export type ClaimedGitHubJob = { id: string; link_id: string; binding_revision: string; delivery_id: string; event_name: string; attempts: number };
export async function claimGitHubJob() {
  await ensureGitHubAppSchema();
  const result = await queryDb<ClaimedGitHubJob>(`UPDATE app_github_webhook_jobs SET status = 'processing',
    attempts = attempts + 1, lease_until = NOW() + INTERVAL '90 seconds', updated_at = NOW()
    WHERE id = (SELECT id FROM app_github_webhook_jobs WHERE
      (status = 'pending' AND next_attempt_at <= NOW()) OR (status = 'processing' AND lease_until < NOW())
      ORDER BY next_attempt_at LIMIT 1 FOR UPDATE SKIP LOCKED)
    RETURNING id,link_id,binding_revision,delivery_id,event_name,attempts`);
  return result.rows[0] ?? null;
}

export async function currentGitHubJobLink(job: ClaimedGitHubJob) {
  const result = await queryDb<LinkRow>(`SELECT l.* FROM app_github_app_image_links l
    JOIN app_users u ON u.email = l.user_email AND u.status = 'active'
    JOIN app_github_repo_installations i ON i.user_email = l.user_email AND i.github_repo = l.github_repo
      AND i.github_installation_id = l.github_installation_id AND i.verified = TRUE
    WHERE l.id = $1 AND l.github_binding_revision = $2 AND l.github_binding_revision <> '' AND l.enabled = TRUE`, [job.link_id, job.binding_revision]);
  return result.rows[0] ?? null;
}

export async function renewGitHubJobLease(job: ClaimedGitHubJob) {
  const result = await queryDb(`UPDATE app_github_webhook_jobs SET lease_until = NOW() + INTERVAL '90 seconds'
    WHERE id = $1 AND attempts = $2 AND status = 'processing' AND lease_until > NOW() RETURNING id`, [job.id, job.attempts]);
  return result.rows.length === 1;
}

export async function finishGitHubJob(job: ClaimedGitHubJob, result: { status: "pending" | "completed" | "cancelled" | "failed"; error?: string; operationId?: string }) {
  await withDbTransaction(async (client) => {
    const updated = await client.query(`UPDATE app_github_webhook_jobs SET status = $3, last_error = $4, operation_id = $5,
      lease_until = NULL, next_attempt_at = NOW() + ($6 * INTERVAL '1 second'), updated_at = NOW()
      WHERE id = $1 AND attempts = $2 AND status = 'processing' RETURNING id`,
    [job.id, job.attempts, result.status, result.error ?? "", result.operationId ?? "", Math.min(300, 15 * 2 ** Math.min(job.attempts, 5))]);
    if (updated.rows.length) await client.query(`UPDATE app_github_app_image_links SET
      github_last_image_sync_error = $3, github_last_image_sync_delivery_id = $4,
      github_last_image_sync_at = CASE WHEN $5 = 'completed' THEN NOW() ELSE github_last_image_sync_at END
      WHERE id = $1 AND github_binding_revision = $2`, [job.link_id, job.binding_revision, result.error ?? "", job.delivery_id, result.status]);
  });
}

export async function retryGitHubImageJobs(email: string, appId: string) {
  await ensureGitHubAppSchema();
  await queryDb(`UPDATE app_github_webhook_jobs j SET status = 'pending', attempts = 0, next_attempt_at = NOW(), updated_at = NOW()
    FROM app_github_app_image_links l WHERE j.link_id = l.id AND l.user_email = $1 AND l.fugue_app_id = $2
      AND l.enabled = TRUE AND j.binding_revision = l.github_binding_revision AND j.status = 'failed'`, [normalizeEmail(email), appId]);
}

export async function revokeGitHubInstallation(installationId: string, repos?: string[]) {
  await ensureGitHubAppSchema();
  await withDbTransaction(async (client) => {
    await client.query("UPDATE app_github_repo_installations SET verified = FALSE, updated_at = NOW() WHERE github_installation_id = $1 AND ($2::text[] IS NULL OR github_repo = ANY($2))", [installationId, repos ?? null]);
    // Preserve intent; the dispatcher refuses unverified or revoked installs.
    await client.query("UPDATE app_github_app_image_links SET github_last_image_sync_error = 'GitHub App installation was removed or suspended.' WHERE github_installation_id = $1 AND ($2::text[] IS NULL OR github_repo = ANY($2))", [installationId, repos ?? null]);
  });
}

export async function pruneGitHubAppHistory() {
  // Bounded housekeeping; never delete queued or leased work. Delivery IDs stay
  // for 30 days even when no binding matched (GitHub redelivery deduplication).
  await withDbTransaction(async (client) => {
    await client.query(`DELETE FROM app_github_webhook_jobs WHERE id IN
      (SELECT id FROM app_github_webhook_jobs WHERE status IN ('completed','cancelled','failed')
       AND updated_at < NOW() - INTERVAL '30 days' ORDER BY updated_at LIMIT 100)`);
    await client.query(`DELETE FROM app_github_webhook_deliveries WHERE id IN
      (SELECT d.id FROM app_github_webhook_deliveries d WHERE received_at < NOW() - INTERVAL '30 days'
       AND NOT EXISTS (SELECT 1 FROM app_github_webhook_jobs j WHERE j.delivery_id = d.id)
       ORDER BY received_at LIMIT 100)`);
    await client.query(`DELETE FROM app_github_install_consumed_states WHERE id IN
      (SELECT id FROM app_github_install_consumed_states WHERE consumed_at < NOW() - INTERVAL '1 day' LIMIT 100)`);
  });
}
