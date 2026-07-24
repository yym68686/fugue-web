import "server-only";

import { jsonError, requireActiveSessionUser } from "@/lib/fugue/product-route";

/**
 * Guard for platform-admin API routes under app/api/admin/*. Requires an active
 * session whose user is a platform admin — the route-handler analogue of
 * requireActiveAdminPageSession (which redirects). On failure it returns a
 * populated `response` (401 when signed out, 403 when signed in but not an
 * admin) that the handler must return immediately; on success `response` is
 * null and `session`/`user` are set.
 */
export async function requireAdminRoute() {
  const auth = await requireActiveSessionUser();
  if (auth.response) return auth;
  if (!auth.user?.isAdmin) {
    return {
      response: jsonError(403, "Admin access required."),
      session: null,
      user: null,
    } as const;
  }
  return auth;
}
