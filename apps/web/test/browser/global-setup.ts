import {
  createCipheriv,
  createHash,
  randomBytes,
  scrypt as scryptCallback,
} from "node:crypto";
import { promisify } from "node:util";

import type { FullConfig } from "@playwright/test";
import { Client } from "pg";

import {
  CONSOLE_ADMIN_USER,
  CONSOLE_BLOCK_TARGET_USER,
  CONSOLE_DELETE_TARGET_USER,
  CONSOLE_DEMOTE_TARGET_USER,
  CONSOLE_ORDINARY_USER,
} from "./console-fixture";

const scrypt = promisify(scryptCallback);
const FIXTURE_EMAILS = [
  CONSOLE_ORDINARY_USER.email,
  CONSOLE_ADMIN_USER.email,
  CONSOLE_BLOCK_TARGET_USER.email,
  CONSOLE_DELETE_TARGET_USER.email,
  CONSOLE_DEMOTE_TARGET_USER.email,
];

function readTestDatabaseUrl() {
  return (
    process.env.PLAYWRIGHT_DATABASE_URL?.trim() ||
    process.env.TEST_DATABASE_URL?.trim() ||
    ""
  );
}

function assertIsolatedTestDatabase(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  const loopback = ["127.0.0.1", "::1", "localhost"].includes(parsed.hostname);

  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !loopback ||
    !/(axe|e2e|playwright|test)/i.test(databaseName)
  ) {
    throw new Error(
      "Playwright Console fixtures require a loopback PostgreSQL database whose name contains test, e2e, axe, or playwright.",
    );
  }
}

function readBaseUrl(config: FullConfig) {
  const configured = config.projects
    .map((project) => project.use.baseURL)
    .find((value): value is string => typeof value === "string" && value.length > 0);

  if (!configured) {
    throw new Error("Playwright Console fixtures require a configured baseURL.");
  }

  return configured;
}

async function initializeApplicationSchema(baseUrl: string) {
  const response = await fetch(`${baseUrl}/api/auth/password/sign-in`, {
    body: JSON.stringify({
      email: "schema-probe@example.test",
      password: "invalid-schema-probe",
      returnTo: "/app",
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (response.status >= 500) {
    throw new Error(
      `The application could not initialize the Playwright database schema (${response.status}): ${await response.text()}`,
    );
  }
}

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt_v1$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

function sealWorkspaceSecret(value: string) {
  const secret = process.env.WORKSPACE_STORE_SECRET?.trim();
  const keyId = process.env.WORKSPACE_STORE_KEY_ID?.trim() || "playwright-v1";

  if (!secret || secret.length < 32) {
    throw new Error(
      "WORKSPACE_STORE_SECRET must contain at least 32 characters for Playwright Console fixtures.",
    );
  }

  const key = createHash("sha256").update(secret, "utf8").digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);

  return [
    "v2",
    keyId,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

async function seedConsoleUsers(databaseUrl: string) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM app_users WHERE email = ANY($1::text[])", [
      FIXTURE_EMAILS,
    ]);
    await client.query("DELETE FROM app_auth_rate_limits");

    const now = new Date().toISOString();
    const fixtures = [
      {
        ...CONSOLE_ORDINARY_USER,
        admin: false,
        adminKeyId: "playwright-member-admin-key",
        tenantId: "playwright-member-tenant",
      },
      {
        ...CONSOLE_ADMIN_USER,
        admin: true,
        adminKeyId: "playwright-admin-admin-key",
        tenantId: "playwright-admin-tenant",
      },
      {
        ...CONSOLE_BLOCK_TARGET_USER,
        admin: false,
        adminKeyId: "playwright-block-target-admin-key",
        tenantId: "playwright-block-target-tenant",
      },
      {
        ...CONSOLE_DELETE_TARGET_USER,
        admin: false,
        adminKeyId: "playwright-delete-target-admin-key",
        tenantId: "playwright-delete-target-tenant",
      },
      {
        ...CONSOLE_DEMOTE_TARGET_USER,
        admin: true,
        adminKeyId: "playwright-demote-target-admin-key",
        tenantId: "playwright-demote-target-tenant",
      },
    ];

    for (const fixture of fixtures) {
      await client.query(
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
            session_version,
            created_at,
            updated_at
          )
          VALUES ($1, $2, NULL, 'email', NULL, TRUE, FALSE, 'active', NULL, 1, $3, $3)
        `,
        [fixture.email, fixture.name, now],
      );
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
          VALUES ($1, 'password', NULL, NULL, $2, $3, $3)
        `,
        [fixture.email, await hashPassword(fixture.password), now],
      );
      await client.query(
        `
          INSERT INTO app_workspaces (
            user_email,
            tenant_id,
            tenant_name,
            default_project_id,
            default_project_name,
            first_app_id,
            admin_key_id,
            admin_key_label,
            admin_key_prefix,
            admin_key_scopes,
            admin_key_secret_sealed,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, NULL, NULL, NULL, $4, 'Playwright workspace admin', 'fg_test', '["*"]'::jsonb, $5, $6, $6)
        `,
        [
          fixture.email,
          fixture.tenantId,
          `${fixture.name} workspace`,
          fixture.adminKeyId,
          sealWorkspaceSecret(`playwright-workspace-key-${fixture.email}`),
          now,
        ],
      );

      if (fixture.admin) {
        await client.query(
          "SELECT set_config('fugue.allow_admin_promotion', 'on', TRUE)",
        );
        await client.query(
          `
            UPDATE app_users
            SET is_admin = TRUE, session_version = session_version + 1, updated_at = $2
            WHERE email = $1
          `,
          [fixture.email, now],
        );
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

async function removeConsoleUsers(databaseUrl: string) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query("DELETE FROM app_users WHERE email = ANY($1::text[])", [
      FIXTURE_EMAILS,
    ]);
  } finally {
    await client.end();
  }
}

export default async function globalSetup(config: FullConfig) {
  const databaseUrl = readTestDatabaseUrl();

  if (!databaseUrl) {
    if (process.env.CI) {
      throw new Error(
        "CI Playwright runs require PLAYWRIGHT_DATABASE_URL or TEST_DATABASE_URL.",
      );
    }
    return;
  }

  assertIsolatedTestDatabase(databaseUrl);
  await initializeApplicationSchema(readBaseUrl(config));
  await seedConsoleUsers(databaseUrl);

  return async () => {
    await removeConsoleUsers(databaseUrl);
  };
}
