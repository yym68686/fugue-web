import "server-only";

import { Pool, type PoolClient, type QueryResultRow } from "pg";

import { getDbEnv } from "@/lib/db/env";

declare global {
  var __fuguePgPool: Pool | undefined;
}

function createPool() {
  return new Pool({
    connectionString: getDbEnv().databaseUrl,
    idleTimeoutMillis: 30_000,
    max: 10,
  });
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
  return getDbPool().query<T>(text, values);
}
