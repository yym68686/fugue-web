import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
} from "@/lib/fugue/product-route";
import { getFugueEnv } from "@/lib/fugue/env";
import {
  getRequestAppUserRecord,
  getRequestSession,
} from "@/lib/server/request-context";
import type { SessionUser } from "@/lib/auth/session";

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

  if (!trimmed) {
    return "";
  }

  const parts = trimmed.split(/\s+/, 2);

  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return "";
  }

  return parts[1]?.trim() ?? "";
}

function buildBootstrapSnapshotSession(): SessionUser {
  return {
    email: "bootstrap-admin@fugue.local",
    provider: "email",
    verified: true,
    authMethod: "email_link",
  };
}

export async function requireAdminSnapshotApiSession() {
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

  if (!bearerToken || bearerToken !== bootstrapKey) {
    return access;
  }

  return {
    response: null,
    session: buildBootstrapSnapshotSession(),
    user: null,
  } as const;
}
