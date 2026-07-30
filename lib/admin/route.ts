import "server-only";

import { getAuthContext, fugueErrorStatus } from "@/lib/fugue/console";
import { jsonError, requireActiveSessionUser } from "@/lib/fugue/product-route";
import { withDbClient } from "@/lib/db/pool";
import { writeSecurityAuditEvent } from "@/lib/security/audit";
import {
  readBearerToken,
  secretsMatch,
} from "@/lib/admin/control-plane-auth";

export type AdminControlPlaneRouteScope = "admin.workspace.resolve.read";

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

function readBootstrapKey() {
  return process.env.FUGUE_BOOTSTRAP_KEY?.trim() ?? "";
}

async function auditControlPlaneKeyUse(
  scope: AdminControlPlaneRouteScope,
  credentialKind: "bootstrap" | "platform-admin",
) {
  await withDbClient((client) =>
    writeSecurityAuditEvent(client, {
      action: "admin.control-plane-key.used",
      metadata: {
        credentialKind,
        scope,
      },
    }),
  );
}

async function authorizeControlPlaneCredential(
  scope: AdminControlPlaneRouteScope,
  credentialKind: "bootstrap" | "platform-admin",
) {
  try {
    await auditControlPlaneKeyUse(scope, credentialKind);
  } catch {
    return {
      response: jsonError(503, "Admin access audit is unavailable."),
      session: null,
      user: null,
    } as const;
  }

  return {
    response: null,
    session: null,
    user: null,
  } as const;
}

/**
 * Read-only admin guard used by the Fugue CLI. Browser requests retain the
 * normal active-session admin check; CLI requests may instead present a Fugue
 * bootstrap or platform-admin bearer credential. Every accepted bearer use is
 * audited before the protected operation runs.
 */
export async function requireAdminManagementRoute(
  request: Request,
  scope: AdminControlPlaneRouteScope,
) {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return requireAdminRoute();
  }

  const bearerToken = readBearerToken(authorization);
  if (!bearerToken) {
    return {
      response: jsonError(401, "Invalid admin API key."),
      session: null,
      user: null,
    } as const;
  }

  const bootstrapKey = readBootstrapKey();
  if (bootstrapKey && secretsMatch(bearerToken, bootstrapKey)) {
    return authorizeControlPlaneCredential(scope, "bootstrap");
  }

  try {
    const context = await getAuthContext(bearerToken);

    if (!context.platformAdmin) {
      return {
        response: jsonError(403, "Platform admin key required."),
        session: null,
        user: null,
      } as const;
    }

    return authorizeControlPlaneCredential(scope, "platform-admin");
  } catch (error) {
    const status = fugueErrorStatus(error);

    if (status === 401) {
      return {
        response: jsonError(401, "Invalid admin API key."),
        session: null,
        user: null,
      } as const;
    }

    if (status === 403) {
      return {
        response: jsonError(403, "Platform admin key required."),
        session: null,
        user: null,
      } as const;
    }

    return {
      response: jsonError(503, "Admin key verification is unavailable."),
      session: null,
      user: null,
    } as const;
  }
}
