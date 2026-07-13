import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PAGE_RETURN_TO_HEADER } from "@/lib/auth/page-request-context";
import { SessionAuthorizationError } from "@/lib/auth/session";
import { buildReturnToHref } from "@/lib/auth/validation";
import { getRequestActiveSessionUserOrThrow } from "@/lib/server/request-context";

function readInactiveSessionError(reason: SessionAuthorizationError["reason"]) {
  if (reason === "blocked") return "account-blocked";
  if (reason === "deleted") return "account-deleted";
  return "session-expired";
}

export async function requireActivePageSession() {
  const headerStore = await headers();
  const returnTo = headerStore.get(PAGE_RETURN_TO_HEADER) || "/app";
  let activeSession: Awaited<ReturnType<typeof getRequestActiveSessionUserOrThrow>>;

  try {
    activeSession = await getRequestActiveSessionUserOrThrow();
  } catch (error) {
    if (error instanceof SessionAuthorizationError) {
      redirect(
        buildReturnToHref(
          `/auth/sign-in?error=${readInactiveSessionError(error.reason)}`,
          returnTo,
        ),
      );
    }

    throw error;
  }

  if (!activeSession) {
    redirect(buildReturnToHref("/auth/sign-in", returnTo));
  }

  return activeSession;
}
