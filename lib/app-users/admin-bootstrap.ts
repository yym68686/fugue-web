import "server-only";

import type { PoolClient } from "pg";

import { isValidEmail, normalizeEmail } from "@/lib/auth/validation";
import { writeSecurityAuditEvent } from "@/lib/security/audit";

const ADMIN_BOOTSTRAP_EMAIL_ENV = "FUGUE_ADMIN_BOOTSTRAP_EMAIL";
const ADMIN_BOOTSTRAP_LOCK_NAMESPACE = 1_180_003_027;
const ADMIN_BOOTSTRAP_LOCK_KEY = 1;

type BootstrapStateRow = {
  admin_email: string | null;
  completed: boolean;
};

export function readConfiguredBootstrapAdminEmail() {
  const rawValue = process.env[ADMIN_BOOTSTRAP_EMAIL_ENV]?.trim();

  if (!rawValue) {
    return null;
  }

  const email = normalizeEmail(rawValue);

  if (!isValidEmail(email)) {
    throw new Error(
      `${ADMIN_BOOTSTRAP_EMAIL_ENV} must contain one valid email address.`,
    );
  }

  return email;
}

export function validateAdminBootstrapConfiguration() {
  readConfiguredBootstrapAdminEmail();
}

async function lockBootstrapState(client: PoolClient) {
  await client.query("SELECT pg_advisory_xact_lock($1, $2)", [
    ADMIN_BOOTSTRAP_LOCK_NAMESPACE,
    ADMIN_BOOTSTRAP_LOCK_KEY,
  ]);
}

async function readBootstrapState(client: PoolClient) {
  const result = await client.query<BootstrapStateRow>(
    `
      SELECT completed, admin_email
      FROM app_admin_bootstrap_state
      WHERE singleton = TRUE
      LIMIT 1
      FOR UPDATE
    `,
  );

  return result.rows[0] ?? null;
}

async function readExistingAdminEmail(client: PoolClient) {
  const result = await client.query<{ email: string }>(
    `
      SELECT email
      FROM app_users
      WHERE is_admin = TRUE
        AND status <> 'deleted'
      ORDER BY created_at ASC, email ASC
      LIMIT 1
      FOR UPDATE
    `,
  );

  const email = result.rows[0]?.email;
  return email ? normalizeEmail(email) : null;
}

async function completeBootstrapState(
  client: PoolClient,
  input: {
    adminEmail: string;
    now: string;
  },
) {
  await client.query(
    `
      INSERT INTO app_admin_bootstrap_state (
        singleton,
        completed,
        admin_email,
        completed_at,
        bootstrap_version,
        updated_at
      )
      VALUES (TRUE, TRUE, $1, $2, 1, $2)
      ON CONFLICT (singleton) DO UPDATE
      SET
        completed = TRUE,
        admin_email = EXCLUDED.admin_email,
        completed_at = COALESCE(
          app_admin_bootstrap_state.completed_at,
          EXCLUDED.completed_at
        ),
        bootstrap_version = GREATEST(
          app_admin_bootstrap_state.bootstrap_version,
          EXCLUDED.bootstrap_version
        ),
        updated_at = EXCLUDED.updated_at
      WHERE app_admin_bootstrap_state.completed = FALSE
    `,
    [input.adminEmail, input.now],
  );
}

/**
 * Grants the one deployment-configured bootstrap admin at most once.
 *
 * The caller must already be in a transaction. A database advisory lock makes
 * the decision global across application instances, while the singleton row
 * makes the completed state durable across restarts and rollbacks.
 */
export async function maybeBootstrapConfiguredAdmin(
  client: PoolClient,
  input: {
    candidateEmail: string;
    now: string;
  },
) {
  const configuredEmail = readConfiguredBootstrapAdminEmail();

  if (!configuredEmail) {
    return false;
  }

  const candidateEmail = normalizeEmail(input.candidateEmail);

  if (candidateEmail !== configuredEmail) {
    return false;
  }

  await lockBootstrapState(client);

  const currentState = await readBootstrapState(client);

  if (currentState?.completed) {
    return false;
  }

  const existingAdminEmail = await readExistingAdminEmail(client);

  if (existingAdminEmail) {
    await completeBootstrapState(client, {
      adminEmail: existingAdminEmail,
      now: input.now,
    });
    await writeSecurityAuditEvent(client, {
      action: "admin.bootstrap.existing-state-migrated",
      actorEmail: existingAdminEmail,
      targetEmail: existingAdminEmail,
    });
    return false;
  }

  await client.query("SELECT set_config('fugue.allow_admin_promotion', 'on', TRUE)");

  const promoted = await client.query<{ email: string }>(
    `
      UPDATE app_users
      SET
        is_admin = TRUE,
        session_version = session_version + 1,
        updated_at = $2
      WHERE email = $1
        AND status = 'active'
        AND is_admin = FALSE
      RETURNING email
    `,
    [candidateEmail, input.now],
  );

  if (!promoted.rows[0]?.email) {
    throw new Error("409 Bootstrap admin is not an active app user.");
  }

  await completeBootstrapState(client, {
    adminEmail: candidateEmail,
    now: input.now,
  });
  await writeSecurityAuditEvent(client, {
    action: "admin.bootstrap.completed",
    actorEmail: candidateEmail,
    targetEmail: candidateEmail,
    metadata: {
      bootstrapVersion: 1,
    },
  });

  return true;
}

export async function getBootstrapAdminEmail(client: PoolClient) {
  const result = await client.query<{ admin_email: string | null }>(
    `
      SELECT admin_email
      FROM app_admin_bootstrap_state
      WHERE singleton = TRUE
        AND completed = TRUE
      LIMIT 1
      FOR UPDATE
    `,
  );

  const email = result.rows[0]?.admin_email;
  return email ? normalizeEmail(email) : null;
}
