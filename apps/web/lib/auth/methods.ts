import "server-only";

import type { PoolClient } from "pg";
import { normalizeEmail } from "@/lib/auth/validation";
import { queryDb, withDbTransaction } from "@/lib/db/pool";
import { ensureDbSchema } from "@/lib/db/schema";
import { writeSecurityAuditEvent } from "@/lib/security/audit";

export type AuthMethodKind = "email_link" | "password" | "google" | "github";

export type PasswordRegistrationResult = {
  created: boolean;
  sessionVersion: number | null;
};

type AuthMethodRow = {
  created_at: Date | string;
  method: string;
  provider_id: string | null;
  provider_label: string | null;
  secret_hash: string | null;
  updated_at: Date | string;
  user_email: string;
};

export type AuthMethodRecord = {
  createdAt: string;
  hasSecret: boolean;
  method: AuthMethodKind;
  providerId: string | null;
  providerLabel: string | null;
  updatedAt: string;
};

const AUTH_METHOD_ORDER: AuthMethodKind[] = [
  "google",
  "github",
  "email_link",
  "password",
];

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

function readMethod(value: unknown): AuthMethodKind | null {
  if (
    value === "email_link" ||
    value === "password" ||
    value === "google" ||
    value === "github"
  ) {
    return value;
  }

  return null;
}

function recordFromRow(row: AuthMethodRow): AuthMethodRecord {
  const method = readMethod(row.method);

  if (!method) {
    throw new Error("Invalid auth method row.");
  }

  return {
    createdAt: readTimestamp(row.created_at),
    hasSecret: Boolean(readOptionalString(row.secret_hash)),
    method,
    providerId: readOptionalString(row.provider_id),
    providerLabel: readOptionalString(row.provider_label),
    updatedAt: readTimestamp(row.updated_at),
  };
}

function sortAuthMethods(records: AuthMethodRecord[]) {
  return [...records].sort((left, right) => {
    const leftIndex = AUTH_METHOD_ORDER.indexOf(left.method);
    const rightIndex = AUTH_METHOD_ORDER.indexOf(right.method);

    return (
      (leftIndex === -1 ? AUTH_METHOD_ORDER.length : leftIndex) -
      (rightIndex === -1 ? AUTH_METHOD_ORDER.length : rightIndex)
    );
  });
}

function isUniqueViolation(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "23505",
  );
}

function readMethodConflictMessage(method: AuthMethodKind) {
  switch (method) {
    case "google":
      return "This Google account is already linked to another Fugue account.";
    case "github":
      return "This GitHub account is already linked to another Fugue account.";
    default:
      return "This sign-in method is already linked elsewhere.";
  }
}

async function listAuthMethodRowsByEmail(client: PoolClient, email: string) {
  const result = await client.query<AuthMethodRow>(
    `
      SELECT
        user_email,
        method,
        provider_id,
        provider_label,
        secret_hash,
        created_at,
        updated_at
      FROM app_auth_methods
      WHERE user_email = $1
      ORDER BY updated_at DESC, created_at DESC, method ASC
    `,
    [normalizeEmail(email)],
  );

  return result.rows;
}

async function countAuthMethodsByEmailWithClient(client: PoolClient, email: string) {
  const result = await client.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM app_auth_methods
      WHERE user_email = $1
    `,
    [normalizeEmail(email)],
  );

  return Number.parseInt(result.rows[0]?.count ?? "0", 10);
}

async function getAuthMethodRowWithClient(
  client: PoolClient,
  email: string,
  method: AuthMethodKind,
) {
  const result = await client.query<AuthMethodRow>(
    `
      SELECT
        user_email,
        method,
        provider_id,
        provider_label,
        secret_hash,
        created_at,
        updated_at
      FROM app_auth_methods
      WHERE user_email = $1
        AND method = $2
      LIMIT 1
    `,
    [normalizeEmail(email), method],
  );

  return result.rows[0] ?? null;
}

async function lockAuthMethodOwner(client: PoolClient, email: string) {
  const result = await client.query<{ email: string }>(
    `
      SELECT email
      FROM app_users
      WHERE email = $1
      LIMIT 1
      FOR UPDATE
    `,
    [normalizeEmail(email)],
  );

  if (!result.rows[0]?.email) {
    throw new Error("404 User not found.");
  }
}

async function revokeSessionsForAuthMethodChange(
  client: PoolClient,
  input: {
    email: string;
    reason: string;
  },
) {
  const normalizedEmail = normalizeEmail(input.email);
  const result = await client.query<{ session_version: number | string }>(
    `
      UPDATE app_users
      SET
        session_version = session_version + 1,
        updated_at = NOW()
      WHERE email = $1
      RETURNING session_version
    `,
    [normalizedEmail],
  );
  const rawVersion = result.rows[0]?.session_version;
  const sessionVersion =
    typeof rawVersion === "number" ? rawVersion : Number.parseInt(rawVersion ?? "", 10);

  if (!Number.isSafeInteger(sessionVersion) || sessionVersion < 1) {
    throw new Error("500 Failed to revoke prior sessions.");
  }

  await writeSecurityAuditEvent(client, {
    action: "user.session.revoked",
    actorEmail: normalizedEmail,
    targetEmail: normalizedEmail,
    metadata: {
      reason: input.reason,
      sessionVersion,
    },
  });
}

async function upsertAuthMethodRow(
  client: PoolClient,
  input: {
    email: string;
    method: AuthMethodKind;
    providerId?: string | null;
    providerLabel?: string | null;
    secretHash?: string | null;
  },
) {
  const normalizedEmail = normalizeEmail(input.email);
  const providerId = readOptionalString(input.providerId);
  const providerLabel = readOptionalString(input.providerLabel)?.slice(0, 160) ?? null;
  const secretHash = readOptionalString(input.secretHash);
  const now = new Date().toISOString();

  try {
    await client.query(
      `
        INSERT INTO app_auth_methods (
          user_email,
          method,
          provider_id,
          provider_label,
          secret_hash,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $6)
        ON CONFLICT (user_email, method) DO UPDATE
        SET
          provider_id = EXCLUDED.provider_id,
          provider_label = EXCLUDED.provider_label,
          secret_hash = EXCLUDED.secret_hash,
          updated_at = EXCLUDED.updated_at
      `,
      [normalizedEmail, input.method, providerId, providerLabel, secretHash, now],
    );
  } catch (error) {
    if (isUniqueViolation(error) && providerId) {
      throw new Error(`409 ${readMethodConflictMessage(input.method)}`);
    }

    throw error;
  }
}

export async function listAuthMethodsByEmail(email: string) {
  await ensureDbSchema();

  const result = await queryDb<AuthMethodRow>(
    `
      SELECT
        user_email,
        method,
        provider_id,
        provider_label,
        secret_hash,
        created_at,
        updated_at
      FROM app_auth_methods
      WHERE user_email = $1
      ORDER BY updated_at DESC, created_at DESC, method ASC
    `,
    [normalizeEmail(email)],
  );

  return sortAuthMethods(result.rows.map(recordFromRow));
}

export async function getAuthMethodByEmail(email: string, method: AuthMethodKind) {
  await ensureDbSchema();

  const result = await queryDb<AuthMethodRow>(
    `
      SELECT
        user_email,
        method,
        provider_id,
        provider_label,
        secret_hash,
        created_at,
        updated_at
      FROM app_auth_methods
      WHERE user_email = $1
        AND method = $2
      LIMIT 1
    `,
    [normalizeEmail(email), method],
  );

  const row = result.rows[0];
  return row ? recordFromRow(row) : null;
}

export async function countAuthMethodsByEmail(email: string) {
  await ensureDbSchema();

  const result = await queryDb<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM app_auth_methods
      WHERE user_email = $1
    `,
    [normalizeEmail(email)],
  );

  return Number.parseInt(result.rows[0]?.count ?? "0", 10);
}

export async function findUserEmailByAuthMethod(
  method: Exclude<AuthMethodKind, "email_link" | "password">,
  providerId: string,
) {
  await ensureDbSchema();

  const result = await queryDb<{ user_email: string }>(
    `
      SELECT user_email
      FROM app_auth_methods
      WHERE method = $1
        AND provider_id = $2
      LIMIT 1
    `,
    [method, readOptionalString(providerId)],
  );

  const value = result.rows[0]?.user_email;
  return value ? normalizeEmail(value) : null;
}

export async function getPasswordHashByEmail(email: string) {
  await ensureDbSchema();

  const result = await queryDb<{ secret_hash: string | null }>(
    `
      SELECT secret_hash
      FROM app_auth_methods
      WHERE user_email = $1
        AND method = 'password'
      LIMIT 1
    `,
    [normalizeEmail(email)],
  );

  return readOptionalString(result.rows[0]?.secret_hash);
}

/**
 * Atomically creates a non-admin password account and its first auth method.
 * Existing identities are deliberately left untouched so public registration
 * can return the same response without becoming an account-takeover path.
 */
export async function registerPasswordAuthMethod(input: {
  email: string;
  name?: string | null;
  passwordHash: string;
}): Promise<PasswordRegistrationResult> {
  await ensureDbSchema();

  return withDbTransaction(async (client) => {
    const normalizedEmail = normalizeEmail(input.email);
    const name = readOptionalString(input.name)?.slice(0, 80) ?? null;
    const now = new Date().toISOString();
    const inserted = await client.query<{ session_version: number | string }>(
      `
        INSERT INTO app_users (
          email,
          name,
          picture_url,
          provider,
          provider_id,
          verified,
          status,
          last_login_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, NULL, 'email', NULL, FALSE, 'active', NULL, $3, $3)
        ON CONFLICT (email) DO NOTHING
        RETURNING session_version
      `,
      [normalizedEmail, name, now],
    );
    const rawSessionVersion = inserted.rows[0]?.session_version;

    if (rawSessionVersion === undefined) {
      return { created: false, sessionVersion: null };
    }

    const sessionVersion =
      typeof rawSessionVersion === "number"
        ? rawSessionVersion
        : Number.parseInt(rawSessionVersion, 10);

    if (!Number.isSafeInteger(sessionVersion) || sessionVersion < 1) {
      throw new Error("500 Invalid password registration session version.");
    }

    await upsertAuthMethodRow(client, {
      email: normalizedEmail,
      method: "password",
      secretHash: input.passwordHash,
    });
    await writeSecurityAuditEvent(client, {
      action: "user.password.registered",
      actorEmail: null,
      targetEmail: normalizedEmail,
      metadata: {
        method: "password",
      },
    });

    return { created: true, sessionVersion };
  });
}

export async function syncAuthMethodOnSignIn(input: {
  email: string;
  method: "email_link" | "google" | "github";
  providerId?: string | null;
  providerLabel?: string | null;
}) {
  await ensureDbSchema();

  return withDbTransaction(async (client) => {
    const normalizedEmail = normalizeEmail(input.email);
    const existingCount = await countAuthMethodsByEmailWithClient(
      client,
      normalizedEmail,
    );

    if (existingCount === 0 && input.method !== "email_link") {
      await upsertAuthMethodRow(client, {
        email: normalizedEmail,
        method: "email_link",
      });
    }

    await upsertAuthMethodRow(client, {
      email: normalizedEmail,
      method: input.method,
      providerId: input.providerId,
      providerLabel: input.providerLabel,
    });

    const rows = await listAuthMethodRowsByEmail(client, normalizedEmail);
    return sortAuthMethods(rows.map(recordFromRow));
  });
}

export async function upsertEmailLinkAuthMethod(email: string) {
  await ensureDbSchema();

  return withDbTransaction(async (client) => {
    await upsertAuthMethodRow(client, {
      email,
      method: "email_link",
    });

    const rows = await listAuthMethodRowsByEmail(client, email);
    return sortAuthMethods(rows.map(recordFromRow));
  });
}

export async function upsertOAuthAuthMethod(input: {
  email: string;
  method: "google" | "github";
  providerId: string;
  providerLabel?: string | null;
}) {
  await ensureDbSchema();

  return withDbTransaction(async (client) => {
    await upsertAuthMethodRow(client, input);
    const rows = await listAuthMethodRowsByEmail(client, input.email);
    return sortAuthMethods(rows.map(recordFromRow));
  });
}

export async function setPasswordAuthMethod(email: string, passwordHash: string) {
  await ensureDbSchema();

  return withDbTransaction(async (client) => {
    await lockAuthMethodOwner(client, email);
    await upsertAuthMethodRow(client, {
      email,
      method: "password",
      secretHash: passwordHash,
    });
    await revokeSessionsForAuthMethodChange(client, {
      email,
      reason: "password-changed",
    });

    const rows = await listAuthMethodRowsByEmail(client, email);
    return sortAuthMethods(rows.map(recordFromRow));
  });
}

export async function touchAuthMethod(email: string, method: AuthMethodKind) {
  await ensureDbSchema();

  const now = new Date().toISOString();
  await queryDb(
    `
      UPDATE app_auth_methods
      SET updated_at = $3
      WHERE user_email = $1
        AND method = $2
    `,
    [normalizeEmail(email), method, now],
  );
}

export async function removeAuthMethod(email: string, method: AuthMethodKind) {
  await ensureDbSchema();

  return withDbTransaction(async (client) => {
    const normalizedEmail = normalizeEmail(email);
    await lockAuthMethodOwner(client, normalizedEmail);
    const current = await getAuthMethodRowWithClient(client, normalizedEmail, method);

    if (!current) {
      const rows = await listAuthMethodRowsByEmail(client, normalizedEmail);
      return sortAuthMethods(rows.map(recordFromRow));
    }

    const currentCount = await countAuthMethodsByEmailWithClient(
      client,
      normalizedEmail,
    );

    if (currentCount <= 1) {
      throw new Error("400 Keep at least one sign-in method on the account.");
    }

    await client.query(
      `
        DELETE FROM app_auth_methods
        WHERE user_email = $1
          AND method = $2
      `,
      [normalizedEmail, method],
    );
    await revokeSessionsForAuthMethodChange(client, {
      email: normalizedEmail,
      reason: `auth-method-removed:${method}`,
    });

    const rows = await listAuthMethodRowsByEmail(client, normalizedEmail);
    return sortAuthMethods(rows.map(recordFromRow));
  });
}
