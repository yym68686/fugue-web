import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import {
  deleteGitHubConnectionByEmail,
  getGitHubConnectionSnapshotByEmail,
} from "@/lib/github/connection-store";
import { isGitHubOAuthConfigured } from "@/lib/github/oauth";
import type { GitHubConnectionView } from "@/lib/github/types";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
} from "@/lib/fugue/product-route";
import { ensureAppUser } from "@/lib/workspace/store";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

function buildConnectionView(
  snapshot: Awaited<ReturnType<typeof getGitHubConnectionSnapshotByEmail>>,
): GitHubConnectionView {
  return {
    authEnabled: isGitHubOAuthConfigured(),
    connected: Boolean(snapshot),
    login: snapshot?.login ?? null,
    name: snapshot?.name ?? null,
    scopes: snapshot?.scopes ?? [],
    updatedAt: snapshot?.updatedAt ?? null,
  };
}

export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    return jsonError(401, "Sign in first.");
  }

  try {
    await ensureAppUser(session);
    const snapshot = await getGitHubConnectionSnapshotByEmail(session.email);
    return NextResponse.json(buildConnectionView(snapshot), {
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}

export async function DELETE() {
  const session = await getCurrentSession();

  if (!session) {
    return jsonError(401, "Sign in first.");
  }

  try {
    await ensureAppUser(session);
    await deleteGitHubConnectionByEmail(session.email);
    return NextResponse.json(
      {
        ok: true,
      },
      {
        headers: NO_STORE_HEADERS,
      },
    );
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
