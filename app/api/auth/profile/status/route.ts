import { NextResponse } from "next/server";

import { getAppUserByEmail } from "@/lib/app-users/store";
import { isGoogleAuthConfigured } from "@/lib/auth/google";
import { listAuthMethodsByEmail } from "@/lib/auth/methods";
import { getCurrentSession } from "@/lib/auth/session";
import {
  getGitHubConnectionSnapshotByEmail,
} from "@/lib/github/connection-store";
import { isGitHubOAuthConfigured } from "@/lib/github/oauth";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
} from "@/lib/fugue/product-route";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

/**
 * Aggregate snapshot backing the /profile page: the signed-in user's display
 * name/email/avatar, every configured sign-in method, and provider connection
 * state. Keeps the client to a single request instead of fanning out across
 * the methods + github/connection endpoints.
 */
export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    return jsonError(401, "Sign in first.");
  }

  try {
    const [user, methods, githubSnapshot] = await Promise.all([
      getAppUserByEmail(session.email),
      listAuthMethodsByEmail(session.email),
      getGitHubConnectionSnapshotByEmail(session.email),
    ]);

    if (!user || user.status !== "active") {
      return jsonError(401, "Session user is no longer active.");
    }

    return NextResponse.json(
      {
        user: {
          email: user.email,
          name: user.name,
          pictureUrl: user.pictureUrl,
        },
        methods,
        providers: {
          google: { authEnabled: isGoogleAuthConfigured() },
          github: {
            authEnabled: isGitHubOAuthConfigured(),
            connected: Boolean(githubSnapshot),
            login: githubSnapshot?.login ?? null,
            scopes: githubSnapshot?.scopes ?? [],
            updatedAt: githubSnapshot?.updatedAt ?? null,
          },
        },
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
