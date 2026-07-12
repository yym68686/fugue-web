import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const databaseUrl = (
  process.env.FUGUE_TEST_DATABASE_URL ?? process.env.TEST_DATABASE_URL
)?.trim();

if (process.env.CI && !databaseUrl) {
  throw new Error(
    "CI integration tests require FUGUE_TEST_DATABASE_URL or TEST_DATABASE_URL",
  );
}

(databaseUrl ? describe : describe.skip)("bounded admin user pagination", () => {
  const fixturePrefix = `page-${process.pid}-${Date.now()}`;
  let closePool: (() => Promise<void>) | null = null;
  let queryDb: typeof import("../../lib/db/pool").queryDb;
  let withDbClient: typeof import("../../lib/db/pool").withDbClient;
  let listAppUsersPage: typeof import("../../lib/app-users/store").listAppUsersPage;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    const poolModule = await import("../../lib/db/pool");
    const schemaModule = await import("../../lib/db/schema");
    const userStore = await import("../../lib/app-users/store");
    queryDb = poolModule.queryDb;
    withDbClient = poolModule.withDbClient;
    listAppUsersPage = userStore.listAppUsersPage;
    closePool = () => poolModule.getDbPool().end();

    await schemaModule.ensureDbSchema();
    await withDbClient(async (client) => {
      await client.query("BEGIN");
      try {
        await client.query("SET LOCAL fugue.allow_admin_promotion = 'on'");
        await client.query(
          `
            INSERT INTO app_users (
              email,
              name,
              provider,
              verified,
              is_admin,
              status,
              session_version,
              last_login_at,
              created_at,
              updated_at
            )
            SELECT
              $1 || '-' || lpad(series::text, 5, '0') || '@example.test',
              'Fixture ' || (series % 127)::text,
              CASE WHEN series % 2 = 0 THEN 'google' ELSE 'email' END,
              TRUE,
              series % 29 = 0,
              CASE
                WHEN series % 41 = 0 THEN 'deleted'
                WHEN series % 17 = 0 THEN 'blocked'
                ELSE 'active'
              END,
              1,
              TIMESTAMPTZ '2026-07-12 00:00:00+00' + ((series % 211) || ' seconds')::interval,
              TIMESTAMPTZ '2026-07-01 00:00:00+00' + ((series % 101) || ' seconds')::interval,
              TIMESTAMPTZ '2026-07-12 00:00:00+00'
            FROM generate_series(1, 10037) AS series
            ON CONFLICT (email) DO NOTHING
          `,
          [fixturePrefix],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });
  });

  afterAll(async () => {
    if (queryDb) {
      await queryDb("DELETE FROM app_users WHERE email LIKE $1", [
        `${fixturePrefix}-%`,
      ]);
    }
    await closePool?.();
  });

  test("10k fixture stays bounded and has no duplicate or missing rows", async () => {
    const seen = new Set<string>();
    let cursor: string | undefined;
    let firstNextCursor: string | null = null;
    let firstPageEmails: string[] = [];

    while (true) {
      const page = await listAppUsersPage({
        cursor,
        limit: 97,
        query: fixturePrefix,
        status: "all",
      });
      expect(page.users.length).toBeLessThanOrEqual(97);
      expect(page.pageInfo.totalItems).toBe(10037);
      for (const user of page.users) {
        expect(seen.has(user.email)).toBeFalse();
        seen.add(user.email);
      }
      if (!cursor) {
        firstPageEmails = page.users.map((user) => user.email);
      }
      firstNextCursor ??= page.pageInfo.nextCursor;
      if (!page.pageInfo.hasNextPage) {
        break;
      }
      expect(page.pageInfo.nextCursor).toBeString();
      cursor = page.pageInfo.nextCursor ?? undefined;
    }

    expect(seen.size).toBe(10037);
    expect(firstNextCursor).toBeString();

    const secondPage = await listAppUsersPage({
      cursor: firstNextCursor ?? undefined,
      limit: 97,
      query: fixturePrefix,
      status: "all",
    });
    expect(secondPage.pageInfo.previousCursor).toBeString();
    const previousPage = await listAppUsersPage({
      cursor: secondPage.pageInfo.previousCursor ?? undefined,
      limit: 97,
      query: fixturePrefix,
      status: "all",
    });
    expect(previousPage.users).toHaveLength(97);
    expect(previousPage.users.map((user) => user.email)).toEqual(firstPageEmails);
  }, 30_000);

  test("status filtering remains server-side", async () => {
    const blocked = await listAppUsersPage({
      limit: 100,
      query: fixturePrefix,
      status: "blocked",
    });
    expect(blocked.users.length).toBeLessThanOrEqual(100);
    expect(blocked.users.every((user) => user.status === "blocked")).toBeTrue();
    expect(blocked.pageInfo.totalItems).toBeGreaterThan(0);
  });

  test("Postgres can satisfy stable ordering with the pagination index", async () => {
    const plan = await withDbClient(async (client) => {
      await client.query("BEGIN");
      try {
        await client.query("SET LOCAL enable_seqscan = off");
        const result = await client.query<{ "QUERY PLAN": string }>(`
          EXPLAIN (COSTS OFF)
          SELECT email
          FROM app_users
          ORDER BY
            CASE WHEN is_admin THEN 0 ELSE 1 END ASC,
            CASE status WHEN 'active' THEN 0 WHEN 'blocked' THEN 1 ELSE 2 END ASC,
            COALESCE(last_login_at, created_at) DESC,
            email ASC
          LIMIT 51
        `);
        await client.query("ROLLBACK");
        return result.rows.map((row) => row["QUERY PLAN"]).join("\n");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });

    expect(plan).toContain("idx_app_users_admin_status_activity_email");
  });
});
