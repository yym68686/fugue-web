import assert from "node:assert/strict";
import test from "node:test";

import type { PoolClient, QueryResult } from "pg";

import {
  maybeBootstrapConfiguredAdmin,
  readConfiguredBootstrapAdminEmail,
} from "../../lib/app-users/admin-bootstrap";

const BOOTSTRAP_EMAIL_ENV = "FUGUE_ADMIN_BOOTSTRAP_EMAIL";

type FakeClientState = {
  releaseLock: (() => void) | null;
};

class FakeBootstrapDatabase {
  private lockTail = Promise.resolve();
  private state: { adminEmail: string; completed: boolean } | null = null;
  promotionCount = 0;

  createClient() {
    const clientState: FakeClientState = { releaseLock: null };
    const query = async (text: string, values?: unknown[]) => {
      if (text.includes("pg_advisory_xact_lock")) {
        let releaseLock!: () => void;
        const previousLock = this.lockTail;
        this.lockTail = new Promise<void>((resolve) => {
          releaseLock = resolve;
        });
        await previousLock;
        clientState.releaseLock = releaseLock;
        return emptyQueryResult();
      }

      if (text.includes("FROM app_admin_bootstrap_state")) {
        return queryResult(
          this.state
            ? [
                {
                  admin_email: this.state.adminEmail,
                  completed: this.state.completed,
                },
              ]
            : [],
        );
      }

      if (text.includes("FROM app_users") && text.includes("is_admin = TRUE")) {
        return queryResult([]);
      }

      if (text.includes("set_config('fugue.allow_admin_promotion'")) {
        return emptyQueryResult();
      }

      if (text.includes("UPDATE app_users") && text.includes("is_admin = TRUE")) {
        this.promotionCount += 1;
        return queryResult([{ email: values?.[0] as string }]);
      }

      if (text.includes("INSERT INTO app_admin_bootstrap_state")) {
        this.state = {
          adminEmail: values?.[0] as string,
          completed: true,
        };
        return emptyQueryResult();
      }

      if (text.includes("INSERT INTO app_security_audit_events")) {
        return emptyQueryResult();
      }

      throw new Error(`Unexpected bootstrap query: ${text}`);
    };

    return {
      client: { query } as unknown as PoolClient,
      commit() {
        clientState.releaseLock?.();
        clientState.releaseLock = null;
      },
    };
  }
}

function queryResult<Row extends Record<string, unknown>>(
  rows: Row[],
): QueryResult<Row> {
  return {
    command: "SELECT",
    fields: [],
    oid: 0,
    rowCount: rows.length,
    rows,
  };
}

function emptyQueryResult() {
  return queryResult([]);
}

async function withBootstrapEmail<T>(email: string | undefined, run: () => Promise<T>) {
  const previous = process.env[BOOTSTRAP_EMAIL_ENV];

  if (email === undefined) {
    delete process.env[BOOTSTRAP_EMAIL_ENV];
  } else {
    process.env[BOOTSTRAP_EMAIL_ENV] = email;
  }

  try {
    return await run();
  } finally {
    if (previous === undefined) {
      delete process.env[BOOTSTRAP_EMAIL_ENV];
    } else {
      process.env[BOOTSTRAP_EMAIL_ENV] = previous;
    }
  }
}

test("missing or mismatched bootstrap configuration never promotes a user", async () => {
  const database = new FakeBootstrapDatabase();

  await withBootstrapEmail(undefined, async () => {
    const connection = database.createClient();
    assert.equal(
      await maybeBootstrapConfiguredAdmin(connection.client, {
        candidateEmail: "first@example.com",
        now: new Date().toISOString(),
      }),
      false,
    );
    connection.commit();
  });

  await withBootstrapEmail("allowed@example.com", async () => {
    const connection = database.createClient();
    assert.equal(
      await maybeBootstrapConfiguredAdmin(connection.client, {
        candidateEmail: "first@example.com",
        now: new Date().toISOString(),
      }),
      false,
    );
    connection.commit();
  });

  assert.equal(database.promotionCount, 0);
});

test("two concurrent configured bootstraps commit at most one promotion", async () => {
  const database = new FakeBootstrapDatabase();

  await withBootstrapEmail("admin@example.com", async () => {
    const runBootstrap = async () => {
      const connection = database.createClient();

      try {
        return await maybeBootstrapConfiguredAdmin(connection.client, {
          candidateEmail: "admin@example.com",
          now: new Date().toISOString(),
        });
      } finally {
        connection.commit();
      }
    };
    const results = await Promise.all([runBootstrap(), runBootstrap()]);

    assert.deepEqual(results.sort(), [false, true]);
  });

  assert.equal(database.promotionCount, 1);
});

test("bootstrap email configuration is normalized and invalid values fail closed", async () => {
  await withBootstrapEmail("  ADMIN@Example.COM ", async () => {
    assert.equal(readConfiguredBootstrapAdminEmail(), "admin@example.com");
  });

  await withBootstrapEmail("not-an-email", async () => {
    assert.throws(
      () => readConfiguredBootstrapAdminEmail(),
      /must contain one valid email address/,
    );
  });
});
