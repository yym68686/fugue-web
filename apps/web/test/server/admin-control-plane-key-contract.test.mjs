import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function findRouteFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findRouteFiles(entryPath);
      return entry.name === "route.ts" ? [entryPath] : [];
    }),
  );
  return files.flat();
}

function relativeRoute(file) {
  return path.relative(webRoot, file).split(path.sep).join("/");
}

test("control-plane bearer credentials are restricted to the audited read-only allow-list", async () => {
  const apiRoot = path.join(webRoot, "app/api");
  const routeFiles = await findRouteFiles(apiRoot);
  const bearerRoutes = [];

  for (const file of routeFiles) {
    const source = await readFile(file, "utf8");
    if (
      source.includes("requireAdminSnapshotApiSession") ||
      source.includes("requireAdminManagementApiSession")
    ) {
      bearerRoutes.push({ file: relativeRoute(file), source });
    }
  }

  assert.deepEqual(bearerRoutes.map(({ file }) => file).sort(), [
    "app/api/admin/workspaces/resolve/route.ts",
    "app/api/fugue/admin/pages/apps/route.ts",
    "app/api/fugue/admin/pages/cluster/route.ts",
    "app/api/fugue/admin/pages/users/enrich/route.ts",
    "app/api/fugue/admin/pages/users/route.ts",
  ]);

  for (const { file, source } of bearerRoutes) {
    assert.match(source, /export\s+async\s+function\s+GET\b/, file);
    assert.doesNotMatch(
      source,
      /export\s+async\s+function\s+(?:POST|PUT|PATCH|DELETE)\b/,
      `${file} must remain read-only`,
    );
  }
});

test("platform mutations require an active browser admin and never accept the management bearer guard", async () => {
  const adminRoot = path.join(webRoot, "app/api/admin");
  const routeFiles = await findRouteFiles(adminRoot);

  for (const file of routeFiles) {
    const source = await readFile(file, "utf8");
    const hasMutation = /export\s+async\s+function\s+(?:POST|PUT|PATCH|DELETE)\b/.test(
      source,
    );
    if (!hasMutation) continue;

    assert.match(source, /requireAdminApiSession\(\)/, relativeRoute(file));
    assert.doesNotMatch(
      source,
      /requireAdmin(?:Snapshot|Management)ApiSession/,
      `${relativeRoute(file)} must not accept a control-plane bearer credential`,
    );
  }
});

test("accepted control-plane keys emit a secret-free, fail-closed audit event", async () => {
  const source = await readFile(path.join(webRoot, "lib/admin/auth.ts"), "utf8");

  assert.match(source, /action:\s*"admin\.control-plane-key\.used"/);
  assert.match(source, /credentialKind,[\s\S]*scope,/);
  assert.doesNotMatch(source, /metadata:\s*\{[^}]*bearerToken/s);
  assert.match(source, /Admin access audit is unavailable\./);
});
