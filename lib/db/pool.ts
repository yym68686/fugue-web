import "server-only";

import { Pool, type PoolClient, type QueryResultRow } from "pg";

import { getDbEnv } from "@/lib/db/env";
import { measurePageDependency, recordPageDatabaseTiming, sqlTimingName } from "@/lib/server/page-timing";

declare global {
  var __fuguePgPool: Pool | undefined;
}

function createPool() {
  const env = getDbEnv();
  const pool = new Pool({
    connectionString: env.databaseUrl,
    idleTimeoutMillis: env.poolIdleTimeoutMillis,
    min: env.poolMinIdle,
    max: 10,
  });
  // pg-pool already removes the failed idle client before emitting this event.
  // Handle it so a database switchover does not terminate the Web process.
  pool.on("error", (error) => logDatabaseConnectionError("fugue_web_database_idle_error", error));
  return pool;
}

function logDatabaseConnectionError(event: string, error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  console.error(JSON.stringify({ event, code: /^[A-Z0-9_]{1,64}$/.test(code) ? code : "unknown" }));
}

export async function warmDbPool() {
  try {
    const pool = getDbPool();
    await Promise.all(Array.from({ length: getDbEnv().poolMinIdle }, async () => {
      const client = await pool.connect();
      let queryError: Error | undefined;
      try {
        await client.query("SELECT 1");
      } catch (error) {
        queryError = error instanceof Error ? error : new Error(String(error));
        throw error;
      } finally {
        client.release(queryError);
      }
    }));
    console.info(JSON.stringify({ event: "fugue_web_database_pool_ready", connections: pool.totalCount }));
  } catch (error) {
    logDatabaseConnectionError("fugue_web_database_pool_warm_failed", error);
  }
}

export function getDbPool() {
  if (!globalThis.__fuguePgPool) {
    globalThis.__fuguePgPool = createPool();
  }

  return globalThis.__fuguePgPool;
}

export async function withDbClient<T>(run: (client: PoolClient) => Promise<T>) {
  const client = await getDbPool().connect();

  try {
    return await run(client);
  } finally {
    client.release();
  }
}

export async function withDbTransaction<T>(run: (client: PoolClient) => Promise<T>) {
  return withDbClient(async (client) => {
    await client.query("BEGIN");

    try {
      const result = await run(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function queryDb<T extends QueryResultRow>(
  text: string,
  values?: unknown[],
) {
  return measurePageDependency("sql", sqlTimingName(text), async () => {
    const started = performance.now();
    const client = await getDbPool().connect();
    const acquired = performance.now();
    let queryError: Error | undefined;
    try {
      return await client.query<T>(text, values);
    } catch (error) {
      queryError = error instanceof Error ? error : new Error(String(error));
      throw error;
    } finally {
      recordPageDatabaseTiming(acquired - started, performance.now() - acquired);
      client.release(queryError);
    }
  });
}

export function requireQueryRow<T>(row: T | undefined, operation: string): T {
  if (row === undefined) {
    throw new Error(`${operation} did not return a database row.`);
  }

  return row;
}
