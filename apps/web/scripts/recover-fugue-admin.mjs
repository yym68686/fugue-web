#!/usr/bin/env node

import process from "node:process";

import pg from "pg";

import { sanitizePublicErrorMessage } from "../lib/security/public-error.mjs";

const CONFIRMATION = "RECOVER_FUGUE_ADMIN";
const LOCK_NAMESPACE = 1_180_003_027;
const LOCK_KEY = 1;

class RecoveryInputError extends Error {}

function readArgument(name) {
  const prefix = `--${name}=`;
  const entry = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return entry?.slice(prefix.length).trim() ?? "";
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) {
    return process.env.DATABASE_URL.trim();
  }

  const prefix = process.env.DB_USER?.trim() ? "DB" : "POSTGRES";
  const user = process.env[`${prefix}_USER`]?.trim();
  const password = process.env[`${prefix}_PASSWORD`]?.trim();
  const database = process.env[prefix === "DB" ? "DB_NAME" : "POSTGRES_DB"]?.trim();
  const host = process.env[`${prefix}_HOST`]?.trim() || "127.0.0.1";
  const port = process.env[`${prefix}_PORT`]?.trim() || "5432";

  if (!user || !password || !database) {
    throw new RecoveryInputError(
      "Set DATABASE_URL or the DB_*/POSTGRES_* database variables before recovery.",
    );
  }

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
}

async function main() {
  const email = normalizeEmail(readArgument("email"));
  const confirmation = readArgument("confirm");

  if (!isValidEmail(email)) {
    throw new RecoveryInputError(
      "Pass one valid target with --email=admin@example.com.",
    );
  }

  if (confirmation !== CONFIRMATION) {
    throw new RecoveryInputError(`Recovery requires --confirm=${CONFIRMATION}.`);
  }

  const client = new pg.Client({ connectionString: buildDatabaseUrl() });
  await client.connect();

  try {
    await client.query("BEGIN");
    const userResult = await client.query(
      `
        SELECT email, status
        FROM app_users
        WHERE email = $1
        LIMIT 1
        FOR UPDATE
      `,
      [email],
    );
    const user = userResult.rows[0];

    if (!user) {
      throw new RecoveryInputError(
        "Recovery target does not exist. Register and verify it first.",
      );
    }

    if (user.status !== "active") {
      throw new RecoveryInputError("Recovery target must already be an active user.");
    }

    // Match the application lock order (user row, then bootstrap singleton)
    // so recovery cannot deadlock an in-flight sign-in for the same account.
    await client.query("SELECT pg_advisory_xact_lock($1, $2)", [
      LOCK_NAMESPACE,
      LOCK_KEY,
    ]);
    await client.query("SELECT set_config('fugue.allow_admin_promotion', 'on', TRUE)");

    const now = new Date().toISOString();
    const promoted = await client.query(
      `
        UPDATE app_users
        SET
          is_admin = TRUE,
          session_version = session_version + 1,
          updated_at = $2
        WHERE email = $1
        RETURNING session_version
      `,
      [email, now],
    );

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
          bootstrap_version = app_admin_bootstrap_state.bootstrap_version + 1,
          updated_at = EXCLUDED.updated_at
      `,
      [email, now],
    );
    await client.query(
      `
        INSERT INTO app_security_audit_events (
          action,
          actor_email,
          target_email,
          metadata,
          created_at
        )
        VALUES (
          'admin.recovered',
          $1,
          $1,
          jsonb_build_object(
            'sessionVersion', $2::bigint,
            'source', 'server-recovery-cli'
          ),
          $3
        )
      `,
      [email, promoted.rows[0].session_version, now],
    );
    await client.query("COMMIT");
    process.stdout.write(`Recovered platform admin access for ${email}.\n`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const status = error instanceof RecoveryInputError ? 400 : 500;
  process.stderr.write(`${sanitizePublicErrorMessage(error, status)}\n`);
  process.exitCode = 1;
});
