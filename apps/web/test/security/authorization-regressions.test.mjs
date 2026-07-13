import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  evaluateSessionAuthorization,
  isCurrentSessionVersion,
  readPositiveSessionVersion,
} from "../../lib/auth/session-policy.ts";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function readRepositoryFile(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

async function listFilesRecursively(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const children = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? listFilesRecursively(entryPath) : [entryPath];
    }),
  );

  return children.flat();
}

test("session versions fail closed and require an exact current version", () => {
  assert.equal(readPositiveSessionVersion(undefined), null);
  assert.equal(readPositiveSessionVersion(0), null);
  assert.equal(readPositiveSessionVersion(1.5), null);
  assert.equal(readPositiveSessionVersion("1"), null);
  assert.equal(readPositiveSessionVersion(1), 1);
  assert.equal(isCurrentSessionVersion(undefined, 1), false);
  assert.equal(isCurrentSessionVersion(1, 2), false);
  assert.equal(isCurrentSessionVersion(2, 2), true);
  assert.deepEqual(evaluateSessionAuthorization({ claimedVersion: 1 }), {
    message: "Session user no longer exists.",
    reason: "missing-user",
    status: 401,
  });
  assert.equal(
    evaluateSessionAuthorization({
      claimedVersion: 1,
      storedVersion: 1,
      userStatus: "active",
    }),
    null,
  );
  assert.equal(
    evaluateSessionAuthorization({
      claimedVersion: 1,
      storedVersion: 2,
      userStatus: "active",
    })?.reason,
    "stale-version",
  );
  assert.equal(
    evaluateSessionAuthorization({
      claimedVersion: 1,
      storedVersion: 1,
      userStatus: "blocked",
    })?.status,
    403,
  );
  assert.equal(
    evaluateSessionAuthorization({
      claimedVersion: 1,
      storedVersion: 1,
      userStatus: "deleted",
    })?.status,
    403,
  );
});

test("first-user and schema bootstrap paths cannot auto-promote a public registration", async () => {
  const store = await readRepositoryFile("lib/app-users/store.ts");
  const schema = await readRepositoryFile("lib/db/schema.ts");
  const bootstrap = await readRepositoryFile("lib/app-users/admin-bootstrap.ts");

  assert.doesNotMatch(store, /visibleUserCount|ensureActiveAdmin/);
  assert.doesNotMatch(
    schema,
    /UPDATE\s+app_users\s+SET\s+is_admin\s*=\s*TRUE\s+WHERE\s+email\s*=\s*\(\s*SELECT/is,
  );
  assert.match(bootstrap, /FUGUE_ADMIN_BOOTSTRAP_EMAIL/);
  assert.match(bootstrap, /pg_advisory_xact_lock/);
  assert.match(bootstrap, /app_admin_bootstrap_state/);
  assert.match(bootstrap, /currentState\?\.completed/);
  assert.match(schema, /guard_app_user_admin_promotion/);
  assert.match(schema, /fugue\.allow_admin_promotion/);
});

test("all product and admin mutation routes cross the centralized active boundary", async () => {
  const routeRoots = ["app/api/admin", "app/api/fugue"].map((directory) =>
    path.join(repositoryRoot, directory),
  );
  const routeFiles = (await Promise.all(routeRoots.map(listFilesRecursively)))
    .flat()
    .filter((file) => file.endsWith("/route.ts"));
  const mutationExport = /export\s+async\s+function\s+(?:POST|PUT|PATCH|DELETE)\b/;
  const acceptedBoundary =
    /require(?:ActiveSessionUser|Session|SessionUser|Admin\w*)\s*\(|getCurrentSession\s*\(/;
  const nonMutatingCompatibilityHandlers = new Set([
    // This endpoint is deliberately inert and always returns HTTP 410.
    "app/api/fugue/billing/top-ups/route.ts",
  ]);
  const unguarded = [];

  for (const routeFile of routeFiles) {
    const source = await readFile(routeFile, "utf8");

    const relativePath = path.relative(repositoryRoot, routeFile);

    if (
      mutationExport.test(source) &&
      !acceptedBoundary.test(source) &&
      !nonMutatingCompatibilityHandlers.has(relativePath)
    ) {
      unguarded.push(relativePath);
    }
  }

  assert.deepEqual(unguarded, []);

  const productRoute = await readRepositoryFile("lib/fugue/product-route.ts");
  const session = await readRepositoryFile("lib/auth/session.ts");
  assert.match(
    productRoute,
    /export\s+async\s+function\s+requireSession\(\)\s*{\s*return\s+requireActiveSessionUser\(\)/,
  );
  assert.match(session, /getAppUserByEmail\(session\.email\)/);
  assert.match(session, /evaluateSessionAuthorization/);
});

test("every authorization mutation rotates the durable session version", async () => {
  const store = await readRepositoryFile("lib/app-users/store.ts");
  const methods = await readRepositoryFile("lib/auth/methods.ts");

  assert.match(
    store,
    /export\s+async\s+function\s+setAppUserStatus[\s\S]*?session_version\s*=\s*session_version\s*\+\s*1/,
  );
  assert.match(
    store,
    /export\s+async\s+function\s+setAppUserAdmin[\s\S]*?session_version\s*=\s*session_version\s*\+\s*1/,
  );
  assert.match(methods, /reason:\s*"password-changed"/);
  assert.match(methods, /lockAuthMethodOwner/);
});

test("admin authorization mutations evict workspace and enrichment caches", async () => {
  const mutationRoutes = [
    "app/api/admin/users/[email]/admin/route.ts",
    "app/api/admin/users/[email]/block/route.ts",
    "app/api/admin/users/[email]/unblock/route.ts",
    "app/api/admin/users/[email]/route.ts",
    "app/api/admin/users/[email]/sessions/route.ts",
  ];

  for (const route of mutationRoutes) {
    const source = await readRepositoryFile(route);

    assert.match(source, /invalidateCachedWorkspaceAccessByEmail\(email\)/);
    assert.match(source, /invalidateAdminUsersPageEnrichmentData\(\)/);
  }
});

test("server-side recovery is explicit and audited", async () => {
  const recovery = await readRepositoryFile("scripts/recover-fugue-admin.mjs");

  assert.match(recovery, /RECOVER_FUGUE_ADMIN/);
  assert.match(recovery, /pg_advisory_xact_lock/);
  assert.match(recovery, /admin\.recovered/);
  assert.match(recovery, /session_version\s*=\s*session_version\s*\+\s*1/);
});

test("the protected server layout owns the stable console shell and role-pruned navigation", async () => {
  const layout = await readRepositoryFile("app/app/layout.tsx");
  const pageAccess = await readRepositoryFile("lib/auth/page-access.ts");
  const requestContext = await readRepositoryFile("lib/server/request-context.ts");
  const adminAuth = await readRepositoryFile("lib/admin/auth.ts");
  const shell = await readRepositoryFile("components/fugue-coss/shells.tsx");
  const clientNavigation = await readRepositoryFile(
    "components/console/console-navigation.tsx",
  );
  const pageFiles = (
    await listFilesRecursively(path.join(repositoryRoot, "app/app"))
  ).filter((file) => file.endsWith("/page.tsx"));

  assert.match(layout, /requireActivePageSession\(\)/);
  assert.match(layout, /isAdmin=\{activeSession\.user\.isAdmin\}/);
  assert.match(pageAccess, /getRequestActiveSessionUserOrThrow\(\)/);
  assert.match(pageAccess, /headerStore\.get\(PAGE_RETURN_TO_HEADER\)/);
  assert.match(requestContext, /const getRequestActiveSessionResult = cache/);
  assert.match(
    adminAuth,
    /export async function requireAdminApiSession\(\)[\s\S]*?const activeSession = await getRequestActiveSessionUser\(\)[\s\S]*?^}/m,
  );
  assert.doesNotMatch(adminAuth, /getRequest(?:Session|AppUserRecord)\(/);
  const layoutFunction = layout.slice(layout.indexOf("export default"));
  assert.equal(
    layoutFunction.indexOf("await requireActivePageSession()"),
    layoutFunction.indexOf("await "),
  );
  assert.match(
    layout,
    /<ConsoleShell[\s\S]*?isAdmin=\{activeSession\.user\.isAdmin\}[\s\S]*?\{children\}[\s\S]*?<\/ConsoleShell>/,
  );
  assert.match(
    shell,
    /\{isAdmin \? <SidebarGroup label=\{messages\.admin\} links=\{links\.admin\} \/> : null\}/,
  );
  assert.doesNotMatch(clientNavigation, /const adminLinks/);

  const pageShellOwners = [];
  const pagesWithoutLeadingPreauthorization = [];

  for (const pageFile of pageFiles) {
    const source = await readFile(pageFile, "utf8");

    if (/\b(?:AdminShell|ConsoleShell)\b/.test(source)) {
      pageShellOwners.push(path.relative(repositoryRoot, pageFile));
    }

    const pageFunction = source.slice(source.indexOf("export default"));
    const guardIndex = pageFunction.search(
      /await require(?:ActivePageSession|AdminPageAccess)\(/,
    );
    const firstAwaitIndex = pageFunction.indexOf("await ");

    if (guardIndex < 0 || guardIndex !== firstAwaitIndex) {
      pagesWithoutLeadingPreauthorization.push(path.relative(repositoryRoot, pageFile));
    }
  }

  assert.deepEqual(pageShellOwners, []);
  assert.deepEqual(pagesWithoutLeadingPreauthorization, []);

  const notFound = await readRepositoryFile("app/app/not-found.tsx");
  assert.match(notFound, /await requireActivePageSession\(\)/);
});
