import "server-only";

import { timingSafeEqual } from "node:crypto";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { logSessionRoleMismatch, type SessionUser } from "@/lib/auth/session";
import { getFugueAuthContext } from "@/lib/fugue/api";
import { getFugueEnv } from "@/lib/fugue/env";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
} from "@/lib/fugue/product-route";
import {
  getRequestAppUserRecord,
  getRequestSession,
} from "@/lib/server/request-context";
import { withDbClient } from "@/lib/db/pool";
import { writeSecurityAuditEvent } from "@/lib/security/audit";

export type AdminControlPlaneRouteScope =
  | "admin.snapshot.apps.read"
  | "admin.snapshot.cluster.read"
  | "admin.snapshot.users.enrichment.read"
  | "admin.snapshot.users.read"
  | "admin.workspace.resolve.read";

function readInactiveRedirect(error: unknown) {
  if (!(error instanceof Error)) {
    return null;
  }

  if (error.message.includes("blocked")) {
    return "/auth/sign-in?error=account-blocked";
  }

  if (error.message.includes("deleted")) {
    return "/auth/sign-in?error=account-deleted";
  }

  return null;
}

export async function requireAdminPageAccess() {
  const session = await getRequestSession();

  if (!session) {
    redirect("/auth/sign-in?error=auth-required");
  }

  try {
    const user = await getRequestAppUserRecord();

    if (!user?.isAdmin) {
      logSessionRoleMismatch(session.email, "platform-admin");
      redirect("/app");
    }

    return {
      session,
      user,
    };
  } catch (error) {
    const destination = readInactiveRedirect(error);

    if (destination) {
      redirect(destination);
    }

    throw error;
  }
}

export async function requireAdminApiSession() {
  const session = await getRequestSession();

  if (!session) {
    return {
      response: jsonError(401, "Sign in first."),
      session: null,
      user: null,
    } as const;
  }

  try {
    const user = await getRequestAppUserRecord();

    if (!user?.isAdmin) {
      logSessionRoleMismatch(session.email, "platform-admin");
      return {
        response: jsonError(403, "Admin access required."),
        session,
        user: null,
      } as const;
    }

    return {
      response: null,
      session,
      user,
    } as const;
  } catch (error) {
    return {
      response: jsonError(readErrorStatus(error), readErrorMessage(error)),
      session: null,
      user: null,
    } as const;
  }
}

function readBearerToken(value: string | null) {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed.length > 4_096) {
    return "";
  }

  const [scheme, token] = trimmed.split(/\s+/, 2);

  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return "";
  }

  return token.trim();
}

function secretsMatch(candidate: string, expected: string) {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}

function buildBootstrapSnapshotSession(): SessionUser {
  return {
    email: "bootstrap-admin@fugue.local",
    provider: "email",
    verified: true,
    authMethod: "email_link",
  };
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

export async function requireAdminSnapshotApiSession(
  scope: Exclude<AdminControlPlaneRouteScope, "admin.workspace.resolve.read">,
) {
  const access = await requireAdminApiSession();

  if (!access.response) {
    return access;
  }

  let bootstrapKey = "";

  try {
    bootstrapKey = getFugueEnv().bootstrapKey;
  } catch {
    return access;
  }

  const headerStore = await headers();
  const bearerToken = readBearerToken(headerStore.get("authorization"));

  if (!bearerToken || !secretsMatch(bearerToken, bootstrapKey)) {
    return access;
  }

  try {
    await auditControlPlaneKeyUse(scope, "bootstrap");
  } catch {
    return {
      response: jsonError(503, "Admin access audit is unavailable."),
      session: null,
      user: null,
    } as const;
  }

  return {
    response: null,
    session: buildBootstrapSnapshotSession(),
    user: null,
  } as const;
}

export async function requireAdminManagementApiSession(
  scope: Extract<AdminControlPlaneRouteScope, "admin.workspace.resolve.read">,
) {
  const headerStore = await headers();
  const bearerToken = readBearerToken(headerStore.get("authorization"));

  if (!bearerToken) {
    return requireAdminApiSession();
  }

  let bootstrapKey = "";

  try {
    bootstrapKey = getFugueEnv().bootstrapKey;
  } catch {
    return {
      response: jsonError(500, "Fugue management key verification is not configured."),
      session: null,
      user: null,
    } as const;
  }

  if (secretsMatch(bearerToken, bootstrapKey)) {
    try {
      await auditControlPlaneKeyUse(scope, "bootstrap");
    } catch {
      return {
        response: jsonError(503, "Admin access audit is unavailable."),
        session: null,
        user: null,
      } as const;
    }

    return {
      response: null,
      session: buildBootstrapSnapshotSession(),
      user: null,
    } as const;
  }

  try {
    const context = await getFugueAuthContext(bearerToken);

    if (context.principal.platformAdmin) {
      try {
        await auditControlPlaneKeyUse(scope, "platform-admin");
      } catch {
        return {
          response: jsonError(503, "Admin access audit is unavailable."),
          session: null,
          user: null,
        } as const;
      }

      return {
        response: null,
        session: buildBootstrapSnapshotSession(),
        user: null,
      } as const;
    }
  } catch {
    return {
      response: jsonError(401, "Invalid admin API key."),
      session: null,
      user: null,
    } as const;
  }

  return {
    response: jsonError(403, "Platform admin key required."),
    session: null,
    user: null,
  } as const;
}
