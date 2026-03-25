import "server-only";

import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { ensureAppUserRecord } from "@/lib/app-users/store";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
} from "@/lib/fugue/product-route";

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
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth/sign-in?error=auth-required");
  }

  try {
    const user = await ensureAppUserRecord(session);

    if (!user.isAdmin) {
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
  const session = await getCurrentSession();

  if (!session) {
    return {
      response: jsonError(401, "Sign in first."),
      session: null,
      user: null,
    } as const;
  }

  try {
    const user = await ensureAppUserRecord(session);

    if (!user.isAdmin) {
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
