import "server-only";

import type { PoolClient } from "pg";

import type { SessionUser } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/validation";
import { ensureDbSchema } from "@/lib/db/schema";
import { queryDb, withDbTransaction } from "@/lib/db/pool";

export type AppUserStatus = "active" | "blocked" | "deleted";

type AppUserRow = {
  created_at: Date | string;
  email: string;
  is_admin: boolean;
  last_login_at: Date | string | null;
  name: string | null;
  picture_url: string | null;
  provider: string;
  provider_id: string | null;
  status: string;
  updated_at: Date | string;
  verified: boolean;
};

export type AppUserRecord = {
  createdAt: string;
  email: string;
  isAdmin: boolean;
  lastLoginAt: string | null;
  name: string | null;
  pictureUrl: string | null;
  provider: string;
  providerId: string | null;
  status: AppUserStatus;
  updatedAt: string;
  verified: boolean;
};

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readTimestamp(value: unknown, fallback: string | null = null) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return fallback;
}

function normalizeStatus(value: unknown): AppUserStatus {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "blocked" || normalized === "deleted") {
      return normalized;
    }
  }

  return "active";
}

function recordFromRow(row: AppUserRow): AppUserRecord {
  const fallbackTimestamp = new Date().toISOString();

  return {
    createdAt: readTimestamp(row.created_at, fallbackTimestamp) ?? fallbackTimestamp,
    email: normalizeEmail(row.email),
    isAdmin: Boolean(row.is_admin),
    lastLoginAt: readTimestamp(row.last_login_at),
    name: readOptionalString(row.name),
    pictureUrl: readOptionalString(row.picture_url),
    provider: readOptionalString(row.provider) ?? "email",
    providerId: readOptionalString(row.provider_id),
    status: normalizeStatus(row.status),
    updatedAt: readTimestamp(row.updated_at, fallbackTimestamp) ?? fallbackTimestamp,
    verified: Boolean(row.verified),
  };
}

function inactiveStatusError(status: AppUserStatus) {
  if (status === "blocked") {
    return new Error("403 User account is blocked.");
  }

  return new Error("403 User account is deleted.");
}

type AppUserSyncPlan = {
  nextName: string | null;
  nextPicture: string | null;
  nextProvider: string;
  nextProviderId: string | null;
  nextVerified: boolean;
  shouldUpdateLastLogin: boolean;
  requiresWrite: boolean;
};

function buildAppUserSyncPlan(
  current:
    | Pick<
        AppUserRecord,
        "name" | "pictureUrl" | "provider" | "providerId" | "status" | "verified"
      >
    | Pick<
        AppUserRow,
        "name" | "picture_url" | "provider" | "provider_id" | "status" | "verified"
      >,
  input: {
    markSignedIn: boolean;
    name: string | null;
    picture: string | null;
    provider: string;
    providerId: string | null;
    verified: boolean;
  },
): AppUserSyncPlan {
  const currentName = "pictureUrl" in current ? current.name : readOptionalString(current.name);
  const currentPicture =
    "pictureUrl" in current
      ? current.pictureUrl
      : readOptionalString(current.picture_url);
  const currentProvider = current.provider;
  const currentProviderId =
    "providerId" in current
      ? current.providerId
      : readOptionalString(current.provider_id);
  const currentStatus = normalizeStatus(current.status);
  const currentVerified = Boolean(current.verified);
  const nextName = input.name ?? currentName;
  const nextPicture = input.picture ?? currentPicture;
  const shouldUpdateLastLogin =
    input.markSignedIn && currentStatus === "active";
  const requiresWrite =
    nextName !== currentName ||
    nextPicture !== currentPicture ||
    input.provider !== currentProvider ||
    input.providerId !== currentProviderId ||
    input.verified !== currentVerified ||
    shouldUpdateLastLogin;

  return {
    nextName,
    nextPicture,
    nextProvider: input.provider,
    nextProviderId: input.providerId,
    nextVerified: input.verified,
    shouldUpdateLastLogin,
    requiresWrite,
  };
}

function ensureUserStatusAllowed(
  record: Pick<AppUserRecord, "status">,
  allowInactive?: boolean,
) {
  if (!allowInactive && record.status !== "active") {
    throw inactiveStatusError(record.status);
  }
}

function isUniqueViolationError(error: unknown) {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

async function ensureActiveAdmin(client: PoolClient, now: string) {
  const activeAdmin = await client.query<{ email: string }>(
    `
      SELECT email
      FROM app_users
      WHERE is_admin = TRUE
        AND status <> 'deleted'
      LIMIT 1
    `,
  );

  if (activeAdmin.rows[0]?.email) {
    return normalizeEmail(activeAdmin.rows[0].email);
  }

  const promoted = await client.query<{ email: string }>(
    `
      WITH candidate AS (
        SELECT email
        FROM app_users
        WHERE status <> 'deleted'
        ORDER BY created_at ASC, email ASC
        LIMIT 1
        FOR UPDATE
      )
      UPDATE app_users
      SET
        is_admin = TRUE,
        updated_at = $1
      WHERE email = (SELECT email FROM candidate)
      RETURNING email
    `,
    [now],
  );

  return promoted.rows[0]?.email ? normalizeEmail(promoted.rows[0].email) : null;
}

async function getBootstrapAdminEmail(
  client: PoolClient,
  options?: {
    forUpdate?: boolean;
  },
) {
  const result = await client.query<{ email: string }>(
    `
      SELECT email
      FROM app_users
      WHERE status <> 'deleted'
      ORDER BY created_at ASC, email ASC
      LIMIT 1
      ${options?.forUpdate ? "FOR UPDATE" : ""}
    `,
  );

  const email = result.rows[0]?.email;
  return email ? normalizeEmail(email) : null;
}

async function getUserRow(
  client: PoolClient,
  email: string,
  options?: {
    forUpdate?: boolean;
  },
) {
  const result = await client.query<AppUserRow>(
    `
      SELECT
        email,
        name,
        picture_url,
        provider,
        provider_id,
        verified,
        is_admin,
        status,
        last_login_at,
        created_at,
        updated_at
      FROM app_users
      WHERE email = $1
      LIMIT 1
      ${options?.forUpdate ? "FOR UPDATE" : ""}
    `,
    [normalizeEmail(email)],
  );

  return result.rows[0] ?? null;
}

export async function getAppUserByEmail(email: string) {
  await ensureDbSchema();

  const result = await queryDb<AppUserRow>(
    `
      SELECT
        email,
        name,
        picture_url,
        provider,
        provider_id,
        verified,
        is_admin,
        status,
        last_login_at,
        created_at,
        updated_at
      FROM app_users
      WHERE email = $1
      LIMIT 1
    `,
    [normalizeEmail(email)],
  );

  const row = result.rows[0];
  return row ? recordFromRow(row) : null;
}

export async function listAppUsers() {
  await ensureDbSchema();

  const result = await queryDb<AppUserRow>(
    `
      SELECT
        email,
        name,
        picture_url,
        provider,
        provider_id,
        verified,
        is_admin,
        status,
        last_login_at,
        created_at,
        updated_at
      FROM app_users
      ORDER BY
        is_admin DESC,
        CASE status
          WHEN 'active' THEN 0
          WHEN 'blocked' THEN 1
          ELSE 2
        END,
        COALESCE(last_login_at, created_at) DESC,
        email ASC
    `,
  );

  return result.rows.map(recordFromRow);
}

export async function ensureAppUserRecord(
  user: SessionUser,
  options?: {
    allowInactive?: boolean;
    markSignedIn?: boolean;
  },
) {
  await ensureDbSchema();

  const now = new Date().toISOString();
  const normalizedEmail = normalizeEmail(user.email);
  const name = readOptionalString(user.name);
  const picture = readOptionalString(user.picture);
  const providerId = readOptionalString(user.providerId);
  const markSignedIn = options?.markSignedIn ?? false;
  const existing = await getAppUserByEmail(normalizedEmail);

  if (existing) {
    const syncPlan = buildAppUserSyncPlan(existing, {
      markSignedIn,
      name,
      picture,
      provider: user.provider,
      providerId,
      verified: user.verified,
    });

    if (!syncPlan.requiresWrite) {
      // Keep routine authenticated reads on a pure read path instead of
      // forcing every request through a synchronous-commit write transaction.
      ensureUserStatusAllowed(existing, options?.allowInactive);
      return existing;
    }
  }

  return withDbTransaction(async (client) => {
    const currentRow = await getUserRow(client, normalizedEmail, {
      forUpdate: true,
    });

    let row: AppUserRow | null = null;
    let shouldEnsureActiveAdmin = false;

    if (!currentRow) {
      const countResult = await client.query<{ count: string }>(
        `
          SELECT COUNT(*)::text AS count
          FROM app_users
          WHERE status <> 'deleted'
        `,
      );
      const visibleUserCount = Number.parseInt(countResult.rows[0]?.count ?? "0", 10);
      const isAdmin = visibleUserCount === 0;
      shouldEnsureActiveAdmin = true;

      try {
        const inserted = await client.query<AppUserRow>(
          `
            INSERT INTO app_users (
              email,
              name,
              picture_url,
              provider,
              provider_id,
              verified,
              is_admin,
              status,
              last_login_at,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $9)
            RETURNING
              email,
              name,
              picture_url,
              provider,
              provider_id,
              verified,
              is_admin,
              status,
              last_login_at,
              created_at,
              updated_at
          `,
          [
            normalizedEmail,
            name,
            picture,
            user.provider,
            providerId,
            user.verified,
            isAdmin,
            markSignedIn ? now : null,
            now,
          ],
        );

        row = inserted.rows[0] ?? null;
      } catch (error) {
        if (!isUniqueViolationError(error)) {
          throw error;
        }

        shouldEnsureActiveAdmin = false;
        const conflictingRow = await getUserRow(client, normalizedEmail, {
          forUpdate: true,
        });

        if (!conflictingRow) {
          throw error;
        }

        const syncPlan = buildAppUserSyncPlan(conflictingRow, {
          markSignedIn,
          name,
          picture,
          provider: user.provider,
          providerId,
          verified: user.verified,
        });

        if (!syncPlan.requiresWrite) {
          row = conflictingRow;
        } else {
          const updated = await client.query<AppUserRow>(
            `
              UPDATE app_users
              SET
                name = $2,
                picture_url = $3,
                provider = $4,
                provider_id = $5,
                verified = $6,
                last_login_at = CASE WHEN $7::boolean THEN $8 ELSE last_login_at END,
                updated_at = $8
              WHERE email = $1
              RETURNING
                email,
                name,
                picture_url,
                provider,
                provider_id,
                verified,
                is_admin,
                status,
                last_login_at,
                created_at,
                updated_at
            `,
            [
              normalizedEmail,
              syncPlan.nextName,
              syncPlan.nextPicture,
              syncPlan.nextProvider,
              syncPlan.nextProviderId,
              syncPlan.nextVerified,
              syncPlan.shouldUpdateLastLogin,
              now,
            ],
          );

          row = updated.rows[0] ?? null;
        }
      }
    } else {
      const current = recordFromRow(currentRow);
      const syncPlan = buildAppUserSyncPlan(current, {
        markSignedIn,
        name,
        picture,
        provider: user.provider,
        providerId,
        verified: user.verified,
      });

      if (!syncPlan.requiresWrite) {
        ensureUserStatusAllowed(current, options?.allowInactive);
        return current;
      }

      const updated = await client.query<AppUserRow>(
        `
          UPDATE app_users
          SET
            name = $2,
            picture_url = $3,
            provider = $4,
            provider_id = $5,
            verified = $6,
            last_login_at = CASE WHEN $7::boolean THEN $8 ELSE last_login_at END,
            updated_at = $8
          WHERE email = $1
          RETURNING
            email,
            name,
            picture_url,
            provider,
            provider_id,
            verified,
            is_admin,
            status,
            last_login_at,
            created_at,
            updated_at
        `,
        [
          normalizedEmail,
          syncPlan.nextName,
          syncPlan.nextPicture,
          syncPlan.nextProvider,
          syncPlan.nextProviderId,
          syncPlan.nextVerified,
          syncPlan.shouldUpdateLastLogin,
          now,
        ],
      );

      row = updated.rows[0] ?? null;
    }

    if (!row) {
      throw new Error("500 Failed to persist app user.");
    }

    const promotedAdminEmail =
      shouldEnsureActiveAdmin && normalizeStatus(row.status) !== "deleted"
        ? await ensureActiveAdmin(client, now)
        : null;
    const record = recordFromRow(row);

    if (promotedAdminEmail === normalizedEmail && !record.isAdmin) {
      row = {
        ...row,
        is_admin: true,
        updated_at: now,
      };
    }

    const resolvedRecord = recordFromRow(row);
    ensureUserStatusAllowed(resolvedRecord, options?.allowInactive);

    return resolvedRecord;
  });
}

export async function setAppUserStatus(
  email: string,
  status: AppUserStatus,
) {
  await ensureDbSchema();

  const normalizedEmail = normalizeEmail(email);
  const nextStatus = normalizeStatus(status);
  const now = new Date().toISOString();

  return withDbTransaction(async (client) => {
    const currentRow = await getUserRow(client, normalizedEmail, {
      forUpdate: true,
    });

    if (!currentRow) {
      throw new Error("404 User not found.");
    }

    const current = recordFromRow(currentRow);

    if (current.isAdmin && nextStatus !== "active") {
      throw new Error("400 Admin users cannot be blocked or deleted.");
    }

    if (current.status === "deleted" && nextStatus !== "deleted") {
      throw new Error("400 Deleted users cannot be restored.");
    }

    if (current.status === nextStatus) {
      return current;
    }

    const updated = await client.query<AppUserRow>(
      `
        UPDATE app_users
        SET
          status = $2,
          updated_at = $3
        WHERE email = $1
        RETURNING
          email,
          name,
          picture_url,
          provider,
          provider_id,
          verified,
          is_admin,
          status,
          last_login_at,
          created_at,
          updated_at
      `,
      [normalizedEmail, nextStatus, now],
    );

    const row = updated.rows[0];

    if (!row) {
      throw new Error("404 User not found.");
    }

    return recordFromRow(row);
  });
}

export async function setAppUserAdmin(email: string, isAdmin: boolean) {
  await ensureDbSchema();

  const normalizedEmail = normalizeEmail(email);
  const nextIsAdmin = Boolean(isAdmin);
  const now = new Date().toISOString();

  return withDbTransaction(async (client) => {
    const currentRow = await getUserRow(client, normalizedEmail, {
      forUpdate: true,
    });

    if (!currentRow) {
      throw new Error("404 User not found.");
    }

    const current = recordFromRow(currentRow);

    if (current.isAdmin === nextIsAdmin) {
      return current;
    }

    if (!nextIsAdmin) {
      const bootstrapAdminEmail = await getBootstrapAdminEmail(client, {
        forUpdate: true,
      });

      if (bootstrapAdminEmail === normalizedEmail) {
        throw new Error("400 Bootstrap admin cannot be demoted.");
      }

      const otherAdmin = await client.query<{ email: string }>(
        `
          SELECT email
          FROM app_users
          WHERE is_admin = TRUE
            AND status <> 'deleted'
            AND email <> $1
          LIMIT 1
        `,
        [normalizedEmail],
      );

      if (!otherAdmin.rows[0]?.email) {
        throw new Error("400 At least one admin is required.");
      }
    }

    if (nextIsAdmin && current.status === "deleted") {
      throw new Error("400 Deleted users cannot become admins.");
    }

    const updated = await client.query<AppUserRow>(
      `
        UPDATE app_users
        SET
          is_admin = $2,
          status = CASE
            WHEN $2::boolean THEN 'active'
            ELSE status
          END,
          updated_at = $3
        WHERE email = $1
        RETURNING
          email,
          name,
          picture_url,
          provider,
          provider_id,
          verified,
          is_admin,
          status,
          last_login_at,
          created_at,
          updated_at
      `,
      [normalizedEmail, nextIsAdmin, now],
    );

    const row = updated.rows[0];

    if (!row) {
      throw new Error("404 User not found.");
    }

    return recordFromRow(row);
  });
}

export async function updateAppUserProfile(
  email: string,
  input: {
    name?: string | null;
  },
) {
  await ensureDbSchema();

  const normalizedEmail = normalizeEmail(email);
  const name = readOptionalString(input.name);
  const now = new Date().toISOString();

  const updated = await queryDb<AppUserRow>(
    `
      UPDATE app_users
      SET
        name = $2,
        updated_at = $3
      WHERE email = $1
      RETURNING
        email,
        name,
        picture_url,
        provider,
        provider_id,
        verified,
        is_admin,
        status,
        last_login_at,
        created_at,
        updated_at
    `,
    [normalizedEmail, name, now],
  );

  const row = updated.rows[0];

  if (!row) {
    throw new Error("404 User not found.");
  }

  return recordFromRow(row);
}
