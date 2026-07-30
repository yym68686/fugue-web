import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  readBearerToken,
  secretsMatch,
} from "@/lib/admin/control-plane-auth";
import {
  buildWorkspaceResolvePayload,
  readWorkspaceResolveEmail,
} from "@/lib/admin/workspace-resolve";

test("workspace resolve accepts one valid email and normalizes it", () => {
  assert.equal(
    readWorkspaceResolveEmail(
      "https://fugue.example/api/admin/workspaces/resolve?email=%20YYM68686%40GMAIL.COM%20",
    ),
    "yym68686@gmail.com",
  );
});

test("workspace resolve rejects missing, duplicate, and invalid emails", () => {
  const base = "https://fugue.example/api/admin/workspaces/resolve";

  assert.equal(readWorkspaceResolveEmail(base), null);
  assert.equal(readWorkspaceResolveEmail(`${base}?email=invalid`), null);
  assert.equal(
    readWorkspaceResolveEmail(`${base}?email=a%40b.com&email=c%40d.com`),
    null,
  );
});

test("workspace resolve returns the CLI contract without key material", () => {
  const workspace = {
    adminKeySecret: "must-not-leak",
    defaultProjectId: "project_1",
    defaultProjectName: "default",
    firstAppId: "app_1",
    tenantId: "tenant_1",
    tenantName: "Example workspace",
  };

  const payload = buildWorkspaceResolvePayload("OWNER@EXAMPLE.COM", workspace);

  assert.deepEqual(payload, {
    email: "owner@example.com",
    workspace: {
      defaultProjectId: "project_1",
      defaultProjectName: "default",
      firstAppId: "app_1",
      tenantId: "tenant_1",
      tenantName: "Example workspace",
    },
  });
  assert.equal(JSON.stringify(payload).includes("must-not-leak"), false);
});

test("management bearer parsing is strict and bounded", () => {
  assert.equal(readBearerToken("Bearer fugue_test"), "fugue_test");
  assert.equal(readBearerToken("bearer fugue_test"), "fugue_test");
  assert.equal(readBearerToken("Basic fugue_test"), "");
  assert.equal(readBearerToken("Bearer fugue_test trailing"), "");
  assert.equal(readBearerToken(`Bearer ${"x".repeat(4_097)}`), "");
});

test("management secret comparison rejects unequal values and lengths", () => {
  assert.equal(secretsMatch("same-secret", "same-secret"), true);
  assert.equal(secretsMatch("same-secret", "other-secret"), false);
  assert.equal(secretsMatch("short", "a-longer-secret"), false);
});

test("workspace resolve bearer endpoint remains read-only and audited", async () => {
  const [routeSource, guardSource] = await Promise.all([
    readFile("app/api/admin/workspaces/resolve/route.ts", "utf8"),
    readFile("lib/admin/route.ts", "utf8"),
  ]);

  assert.match(routeSource, /export\s+async\s+function\s+GET\b/);
  assert.doesNotMatch(
    routeSource,
    /export\s+async\s+function\s+(?:POST|PUT|PATCH|DELETE)\b/,
  );
  assert.match(routeSource, /requireAdminManagementRoute/);
  assert.match(routeSource, /admin\.workspace\.resolve\.read/);
  assert.match(guardSource, /action:\s*"admin\.control-plane-key\.used"/);
  const metadata = /metadata:\s*\{([^}]*)\}/.exec(guardSource)?.[1] ?? "";
  assert.doesNotMatch(metadata, /bearerToken/);
});
