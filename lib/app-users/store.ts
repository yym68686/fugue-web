import "server-only";

import { createHash } from "node:crypto";
import type { PoolClient } from "pg";

import {
  getBootstrapAdminEmail,
  maybeBootstrapConfiguredAdmin,
  readConfiguredBootstrapAdminEmail,
} from "@/lib/app-users/admin-bootstrap";
import type { SessionUser } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/validation";
import { queryDb, withDbTransaction } from "@/lib/db/pool";
import { ensureDbSchema, withDbSchemaRetry } from "@/lib/db/schema";
import { writeSecurityAuditEvent } from "@/lib/security/audit";

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
  session_version: number | string;
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
  sessionVersion: number;
  status: AppUserStatus;
  updatedAt: string;
  verified: boolean;
};

export const APP_USER_PAGE_DEFAULT_LIMIT = 50;
export const APP_USER_PAGE_MAX_LIMIT = 100;

export type AppUserPageFilter = "active" | "admin" | "all" | "blocked" | "deleted";

export type AppUserPageOptions = {
  cursor?: string;
  limit?: number;
  query?: string;
  status?: AppUserPageFilter;
};

export type AppUserPageSummary = {
  adminCount: number;
  blockedCount: number;
  deletedCount: number;
  userCount: number;
};

export type AppUserPageInfo = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  limit: number;
  nextCursor: string | null;
  previousCursor: string | null;
  totalItems: number;
};

export type AppUserPage = {
  pageInfo: AppUserPageInfo;
  summary: AppUserPageSummary;
  users: AppUserRecord[];
};

type AppUserPageStatsRow = {
  admin_count: number | string;
  blocked_count: number | string;
  deleted_count: number | string;
  total_items: number | string;
  user_count: number | string;
};

type AppUserCursor = {
  adminRank: number;
  direction: "next" | "previous";
  email: string;
  lastActivityAt: string;
  scope: string;
  statusRank: number;
  version: 1;
};

const APP_USER_PAGE_SORT_SQL = `
  CASE WHEN is_admin THEN 0 ELSE 1 END ASC,
  CASE status WHEN 'active' THEN 0 WHEN 'blocked' THEN 1 ELSE 2 END ASC,
  COALESCE(last_login_at, created_at) DESC,
  email ASC
`;

const APP_USER_PAGE_REVERSE_SORT_SQL = `
  CASE WHEN is_admin THEN 0 ELSE 1 END DESC,
  CASE status WHEN 'active' THEN 0 WHEN 'blocked' THEN 1 ELSE 2 END DESC,
  COALESCE(last_login_at, created_at) ASC,
  email DESC
`;

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

function readSessionVersion(value: unknown) {
  const version =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error("Invalid app user session version.");
  }

  return version;
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
    sessionVersion: readSessionVersion(row.session_version),
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
  const currentName =
    "pictureUrl" in current ? current.name : readOptionalString(current.name);
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
  const shouldUpdateLastLogin = input.markSignedIn && currentStatus === "active";
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
        session_version,
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
  const result = await withDbSchemaRetry(() =>
    queryDb<AppUserRow>(
      `
        SELECT
          email,
          name,
          picture_url,
          provider,
          provider_id,
          verified,
          is_admin,
          session_version,
          status,
          last_login_at,
          created_at,
          updated_at
        FROM app_users
        WHERE email = $1
        LIMIT 1
      `,
      [normalizeEmail(email)],
    ),
  );

  const row = result.rows[0];
  return row ? recordFromRow(row) : null;
}

export async function listAppUsers() {
  const result = await withDbSchemaRetry(() =>
    queryDb<AppUserRow>(
      `
        SELECT
          email,
          name,
          picture_url,
          provider,
          provider_id,
          verified,
          is_admin,
          session_version,
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
    ),
  );

  return result.rows.map(recordFromRow);
}

function readCount(value: number | string, label: string) {
  const count = typeof value === "number" ? value : Number.parseInt(value, 10);

  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`Invalid ${label} count.`);
  }

  return count;
}

function normalizeAppUserPageOptions(options: AppUserPageOptions) {
  const limit = options.limit ?? APP_USER_PAGE_DEFAULT_LIMIT;
  const query = options.query?.trim() ?? "";
  const status = options.status ?? "all";

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > APP_USER_PAGE_MAX_LIMIT) {
    throw new Error(`400 limit must be between 1 and ${APP_USER_PAGE_MAX_LIMIT}.`);
  }
  if (query.length > 200) {
    throw new Error("400 q must be at most 200 characters.");
  }
  if (
    status !== "all" &&
    status !== "active" &&
    status !== "blocked" &&
    status !== "deleted" &&
    status !== "admin"
  ) {
    throw new Error("400 status must be all, active, blocked, deleted, or admin.");
  }

  return {
    cursor: options.cursor?.trim() ?? "",
    limit,
    query,
    status,
  };
}

function appUserCursorScope(query: string, status: AppUserPageFilter) {
  return createHash("sha256")
    .update(
      `q=${query.toLowerCase()}\nstatus=${status}\nsort=admin_status_activity_email`,
    )
    .digest("hex")
    .slice(0, 32);
}

function appUserStatusRank(status: AppUserStatus) {
  if (status === "active") {
    return 0;
  }
  if (status === "blocked") {
    return 1;
  }
  return 2;
}

function encodeAppUserCursor(
  user: AppUserRecord,
  direction: AppUserCursor["direction"],
  scope: string,
) {
  const payload: AppUserCursor = {
    adminRank: user.isAdmin ? 0 : 1,
    direction,
    email: user.email,
    lastActivityAt: user.lastLoginAt ?? user.createdAt,
    scope,
    statusRank: appUserStatusRank(user.status),
    version: 1,
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeAppUserCursor(raw: string, scope: string): AppUserCursor {
  if (!raw || raw.length > 1024) {
    throw new Error("409 Invalid or expired cursor; restart from the first page.");
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as Partial<AppUserCursor>;
    const timestamp =
      typeof parsed.lastActivityAt === "string"
        ? new Date(parsed.lastActivityAt)
        : null;
    if (
      parsed.version !== 1 ||
      parsed.scope !== scope ||
      (parsed.direction !== "next" && parsed.direction !== "previous") ||
      (parsed.adminRank !== 0 && parsed.adminRank !== 1) ||
      !Number.isInteger(parsed.statusRank) ||
      (parsed.statusRank ?? -1) < 0 ||
      (parsed.statusRank ?? 3) > 2 ||
      typeof parsed.email !== "string" ||
      !parsed.email.trim() ||
      !timestamp ||
      Number.isNaN(timestamp.getTime())
    ) {
      throw new Error("invalid");
    }

    return {
      adminRank: parsed.adminRank,
      direction: parsed.direction,
      email: normalizeEmail(parsed.email),
      lastActivityAt: timestamp.toISOString(),
      scope: parsed.scope,
      statusRank: parsed.statusRank as number,
      version: 1,
    };
  } catch {
    throw new Error("409 Invalid or expired cursor; restart from the first page.");
  }
}

function buildAppUserPageFilterSQL(query: string, status: AppUserPageFilter) {
  const clauses: string[] = [];
  const values: unknown[] = [];
  const addValue = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (query) {
    const placeholder = addValue(`%${query.toLowerCase()}%`);
    clauses.push(`(
      lower(email) LIKE ${placeholder}
      OR lower(COALESCE(name, '')) LIKE ${placeholder}
      OR lower(provider) LIKE ${placeholder}
    )`);
  }
  if (status === "admin") {
    clauses.push("is_admin = TRUE");
  } else if (status !== "all") {
    clauses.push(`status = ${addValue(status)}`);
  }

  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
}

function buildAppUserCursorPredicate(cursor: AppUserCursor, firstParameter: number) {
  const [admin, status, activity, email] = [
    `$${firstParameter}`,
    `$${firstParameter + 1}`,
    `$${firstParameter + 2}`,
    `$${firstParameter + 3}`,
  ];
  const next = cursor.direction === "next";
  const rankOperator = next ? ">" : "<";
  const activityOperator = next ? "<" : ">";
  const emailOperator = next ? ">" : "<";

  return `(
    CASE WHEN is_admin THEN 0 ELSE 1 END ${rankOperator} ${admin}
    OR (
      CASE WHEN is_admin THEN 0 ELSE 1 END = ${admin}
      AND CASE status WHEN 'active' THEN 0 WHEN 'blocked' THEN 1 ELSE 2 END ${rankOperator} ${status}
    )
    OR (
      CASE WHEN is_admin THEN 0 ELSE 1 END = ${admin}
      AND CASE status WHEN 'active' THEN 0 WHEN 'blocked' THEN 1 ELSE 2 END = ${status}
      AND COALESCE(last_login_at, created_at) ${activityOperator} ${activity}
    )
    OR (
      CASE WHEN is_admin THEN 0 ELSE 1 END = ${admin}
      AND CASE status WHEN 'active' THEN 0 WHEN 'blocked' THEN 1 ELSE 2 END = ${status}
      AND COALESCE(last_login_at, created_at) = ${activity}
      AND email ${emailOperator} ${email}
    )
  )`;
}

export async function listAppUsersPage(
  input: AppUserPageOptions = {},
): Promise<AppUserPage> {
  const options = normalizeAppUserPageOptions(input);
  const scope = appUserCursorScope(options.query, options.status);
  const cursor = options.cursor ? decodeAppUserCursor(options.cursor, scope) : null;
  const filter = buildAppUserPageFilterSQL(options.query, options.status);

  const pageValues = [...filter.values];
  const pageConditions = filter.sql ? [filter.sql.replace(/^WHERE\s+/, "")] : [];
  if (cursor) {
    pageConditions.push(buildAppUserCursorPredicate(cursor, pageValues.length + 1));
    pageValues.push(
      cursor.adminRank,
      cursor.statusRank,
      cursor.lastActivityAt,
      cursor.email,
    );
  }
  pageValues.push(options.limit + 1);
  const limitParameter = `$${pageValues.length}`;
  const reverse = cursor?.direction === "previous";

  const [pageResult, statsResult] = await Promise.all([
    withDbSchemaRetry(() =>
      queryDb<AppUserRow>(
        `
          SELECT
            email,
            name,
            picture_url,
            provider,
            provider_id,
            verified,
            is_admin,
            session_version,
            status,
            last_login_at,
            created_at,
            updated_at
          FROM app_users
          ${pageConditions.length > 0 ? `WHERE ${pageConditions.join(" AND ")}` : ""}
          ORDER BY ${reverse ? APP_USER_PAGE_REVERSE_SORT_SQL : APP_USER_PAGE_SORT_SQL}
          LIMIT ${limitParameter}
        `,
        pageValues,
      ),
    ),
    withDbSchemaRetry(() =>
      queryDb<AppUserPageStatsRow>(
        `
          SELECT
            (SELECT COUNT(*) FROM app_users ${filter.sql}) AS total_items,
            COUNT(*) AS user_count,
            COUNT(*) FILTER (WHERE is_admin = TRUE) AS admin_count,
            COUNT(*) FILTER (WHERE status = 'blocked') AS blocked_count,
            COUNT(*) FILTER (WHERE status = 'deleted') AS deleted_count
          FROM app_users
        `,
        filter.values,
      ),
    ),
  ]);

  const stats = statsResult.rows[0];
  if (!stats) {
    throw new Error("Failed to read app user page statistics.");
  }
  const totalItems = readCount(stats.total_items, "filtered user");
  if (cursor && pageResult.rows.length === 0 && totalItems > 0) {
    throw new Error("409 Invalid or expired cursor; restart from the first page.");
  }

  const overflow = pageResult.rows.length > options.limit;
  let rows = overflow ? pageResult.rows.slice(0, options.limit) : pageResult.rows;
  if (reverse) {
    rows = rows.slice().reverse();
  }
  const users = rows.map(recordFromRow);
  const hasNextPage = reverse ? Boolean(cursor) : overflow;
  const hasPreviousPage = reverse ? overflow : Boolean(cursor);

  return {
    pageInfo: {
      hasNextPage,
      hasPreviousPage,
      limit: options.limit,
      nextCursor:
        hasNextPage && users.length > 0
          ? encodeAppUserCursor(users[users.length - 1] as AppUserRecord, "next", scope)
          : null,
      previousCursor:
        hasPreviousPage && users.length > 0
          ? encodeAppUserCursor(users[0] as AppUserRecord, "previous", scope)
          : null,
      totalItems,
    },
    summary: {
      adminCount: readCount(stats.admin_count, "admin user"),
      blockedCount: readCount(stats.blocked_count, "blocked user"),
      deletedCount: readCount(stats.deleted_count, "deleted user"),
      userCount: readCount(stats.user_count, "user"),
    },
    users,
  };
}

export async function getAppBootstrapAdminEmail() {
  const result = await withDbSchemaRetry(() =>
    queryDb<{ admin_email: string | null }>(
      `
        SELECT admin_email
        FROM app_admin_bootstrap_state
        WHERE singleton = TRUE
          AND completed = TRUE
        LIMIT 1
      `,
    ),
  );
  const email = result.rows[0]?.admin_email;
  return email ? normalizeEmail(email) : null;
}

export async function ensureAppUserRecord(
  user: SessionUser,
  options?: {
    allowInactive?: boolean;
    markSignedIn?: boolean;
  },
) {
  const now = new Date().toISOString();
  const normalizedEmail = normalizeEmail(user.email);
  const name = readOptionalString(user.name);
  const picture = readOptionalString(user.picture);
  const providerId = readOptionalString(user.providerId);
  const markSignedIn = options?.markSignedIn ?? false;
  const configuredBootstrapEmail = readConfiguredBootstrapAdminEmail();
  const shouldEvaluateBootstrap =
    markSignedIn && configuredBootstrapEmail === normalizedEmail;
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

    if (!syncPlan.requiresWrite && !shouldEvaluateBootstrap) {
      // Keep routine authenticated reads on a pure read path instead of
      // forcing every request through a synchronous-commit write transaction.
      ensureUserStatusAllowed(existing, options?.allowInactive);
      return existing;
    }
  }

  await ensureDbSchema();

  return withDbTransaction(async (client) => {
    const currentRow = await getUserRow(client, normalizedEmail, {
      forUpdate: true,
    });

    let row: AppUserRow | null = null;

    if (!currentRow) {
      const inserted = await client.query<AppUserRow>(
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
          VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $8)
          ON CONFLICT (email) DO UPDATE
          SET
            name = COALESCE(EXCLUDED.name, app_users.name),
            picture_url = COALESCE(EXCLUDED.picture_url, app_users.picture_url),
            provider = EXCLUDED.provider,
            provider_id = EXCLUDED.provider_id,
            verified = EXCLUDED.verified,
            last_login_at = CASE
              WHEN $9::boolean AND app_users.status = 'active' THEN $8
              ELSE app_users.last_login_at
            END,
            updated_at = $8
          RETURNING
            email,
            name,
            picture_url,
            provider,
            provider_id,
            verified,
            is_admin,
            session_version,
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
          markSignedIn ? now : null,
          now,
          markSignedIn,
        ],
      );

      row = inserted.rows[0] ?? null;
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

      if (!syncPlan.requiresWrite && !shouldEvaluateBootstrap) {
        ensureUserStatusAllowed(current, options?.allowInactive);
        return current;
      }

      if (!syncPlan.requiresWrite) {
        row = currentRow;
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
              session_version,
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

    if (!row) {
      throw new Error("500 Failed to persist app user.");
    }

    ensureUserStatusAllowed(recordFromRow(row), options?.allowInactive);

    if (shouldEvaluateBootstrap) {
      const promoted = await maybeBootstrapConfiguredAdmin(client, {
        candidateEmail: normalizedEmail,
        now,
      });

      if (promoted) {
        row = await getUserRow(client, normalizedEmail, { forUpdate: true });

        if (!row) {
          throw new Error("500 Failed to read bootstrapped app user.");
        }
      }
    }

    const resolvedRecord = recordFromRow(row);
    ensureUserStatusAllowed(resolvedRecord, options?.allowInactive);

    return resolvedRecord;
  });
}

export async function setAppUserStatus(
  email: string,
  status: AppUserStatus,
  options?: {
    actorEmail?: string | null;
  },
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
          session_version = session_version + 1,
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
          session_version,
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

    await writeSecurityAuditEvent(client, {
      action: "user.status.changed",
      actorEmail: options?.actorEmail,
      targetEmail: normalizedEmail,
      metadata: {
        from: current.status,
        sessionVersion: readSessionVersion(row.session_version),
        to: nextStatus,
      },
    });

    return recordFromRow(row);
  });
}

export async function setAppUserAdmin(
  email: string,
  isAdmin: boolean,
  options?: {
    actorEmail?: string | null;
  },
) {
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
      const bootstrapAdminEmail = await getBootstrapAdminEmail(client);

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

    if (nextIsAdmin) {
      await client.query(
        "SELECT set_config('fugue.allow_admin_promotion', 'on', TRUE)",
      );
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
          session_version = session_version + 1,
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
          session_version,
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

    await writeSecurityAuditEvent(client, {
      action: "user.admin-role.changed",
      actorEmail: options?.actorEmail,
      targetEmail: normalizedEmail,
      metadata: {
        from: current.isAdmin,
        sessionVersion: readSessionVersion(row.session_version),
        to: nextIsAdmin,
      },
    });

    return recordFromRow(row);
  });
}

export async function revokeAppUserSessions(
  email: string,
  options?: {
    actorEmail?: string | null;
    reason?: string;
  },
) {
  await ensureDbSchema();

  const normalizedEmail = normalizeEmail(email);
  const now = new Date().toISOString();

  return withDbTransaction(async (client) => {
    const updated = await client.query<AppUserRow>(
      `
        UPDATE app_users
        SET
          session_version = session_version + 1,
          updated_at = $2
        WHERE email = $1
        RETURNING
          email,
          name,
          picture_url,
          provider,
          provider_id,
          verified,
          is_admin,
          session_version,
          status,
          last_login_at,
          created_at,
          updated_at
      `,
      [normalizedEmail, now],
    );
    const row = updated.rows[0];

    if (!row) {
      throw new Error("404 User not found.");
    }

    await writeSecurityAuditEvent(client, {
      action: "user.session.revoked",
      actorEmail: options?.actorEmail,
      targetEmail: normalizedEmail,
      metadata: {
        reason: options?.reason?.trim().slice(0, 120) || "manual",
        sessionVersion: readSessionVersion(row.session_version),
      },
    });

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
        session_version,
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
