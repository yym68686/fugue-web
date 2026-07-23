import "server-only";

/**
 * The full scope set granted to a workspace's tenant-admin key. This mirrors
 * every capability a workspace owner needs to manage their own projects, apps,
 * runtimes, DNS, and data — scoped strictly to their own tenant by the backend.
 */
export const WORKSPACE_ADMIN_SCOPES = [
  "project.write",
  "apikey.write",
  "runtime.attach",
  "runtime.write",
  "runtime.reserve",
  "billing.write",
  "app.write",
  "app.deploy",
  "app.scale",
  "app.migrate",
  "app.delete",
  "dns.read",
  "dns.write",
  "data.read",
  "data.write",
  "data.delete",
  "data.grant",
  "data.admin",
] as const;

/** Deduplicate and sort scopes so equality checks are order-independent. */
export function sortFugueScopes(scopes: readonly string[]) {
  return [...new Set(scopes.map((scope) => scope.trim()).filter(Boolean))].sort();
}
