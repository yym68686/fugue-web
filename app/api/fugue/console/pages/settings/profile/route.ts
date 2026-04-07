import { NextResponse } from "next/server";

import { ensureAppUserRecord } from "@/lib/app-users/store";
import { isGitHubAuthConfigured } from "@/lib/auth/github";
import {
  listAuthMethodsByEmail,
  syncAuthMethodOnSignIn,
  upsertEmailLinkAuthMethod,
} from "@/lib/auth/methods";
import { isGoogleAuthConfigured } from "@/lib/auth/google";
import { getCurrentSession } from "@/lib/auth/session";
import type { ConsoleProfileSettingsPageSnapshot } from "@/lib/console/page-snapshot-types";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
} from "@/lib/fugue/product-route";

export const dynamic = "force-dynamic";

function jsonSnapshot(snapshot: ConsoleProfileSettingsPageSnapshot) {
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    return jsonError(401, "Sign in first.");
  }

  try {
    const [user, currentMethods] = await Promise.all([
      ensureAppUserRecord(session),
      listAuthMethodsByEmail(session.email),
    ]);
    const methods =
      currentMethods.length > 0
        ? currentMethods
        : session.authMethod === "google" || session.authMethod === "github" || session.authMethod === "email_link"
          ? await syncAuthMethodOnSignIn({
              email: session.email,
              method: session.authMethod,
              providerId: session.providerId,
              providerLabel:
                session.authMethod === "github"
                  ? null
                  : session.provider === "google"
                    ? session.email
                    : null,
            })
          : await upsertEmailLinkAuthMethod(session.email);

    return jsonSnapshot({
      availableMethods: {
        github: isGitHubAuthConfigured(),
        google: isGoogleAuthConfigured(),
      },
      methods,
      session,
      state: "ready",
      user,
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
