import "server-only";

import { queryDb } from "@/lib/db/pool";
import { withDbSchemaRetry } from "@/lib/db/schema";

type AdminSnapshotRow = {
  payload: unknown;
  updated_at: Date | string;
};

export type AdminSnapshotCacheEntry<T> = {
  ageMs: number;
  payload: T;
  updatedAt: string;
};

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

  return new Date(0).toISOString();
}

export async function readAdminSnapshotCache<T>(
  key: string,
): Promise<AdminSnapshotCacheEntry<T> | null> {
  const result = await withDbSchemaRetry(() =>
    queryDb<AdminSnapshotRow>(
      `
        SELECT payload, updated_at
        FROM app_admin_snapshots
        WHERE key = $1
        LIMIT 1
      `,
      [key],
    ),
  );
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const updatedAt = readTimestamp(row.updated_at);
  const updatedAtMs = Date.parse(updatedAt);

  return {
    ageMs: Number.isFinite(updatedAtMs)
      ? Math.max(0, Date.now() - updatedAtMs)
      : Number.POSITIVE_INFINITY,
    payload: row.payload as T,
    updatedAt,
  };
}

export async function writeAdminSnapshotCache<T>(key: string, payload: T) {
  await withDbSchemaRetry(() =>
    queryDb(
      `
        INSERT INTO app_admin_snapshots (key, payload, created_at, updated_at)
        VALUES ($1, $2::jsonb, NOW(), NOW())
        ON CONFLICT (key) DO UPDATE
        SET
          payload = EXCLUDED.payload,
          updated_at = EXCLUDED.updated_at
      `,
      [key, JSON.stringify(payload)],
    ),
  );
}

export async function deleteAdminSnapshotCache(key: string) {
  await withDbSchemaRetry(() =>
    queryDb(
      `
        DELETE FROM app_admin_snapshots
        WHERE key = $1
      `,
      [key],
    ),
  );
}
