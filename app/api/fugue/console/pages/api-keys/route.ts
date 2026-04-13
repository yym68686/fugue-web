import { after, NextResponse } from "next/server";

import type { ConsoleApiKeysPageSnapshot } from "@/lib/console/page-snapshot-types";
import {
  getApiKeyPageDataForWorkspace,
  getStoredApiKeyPageDataForWorkspace,
} from "@/lib/api-keys/service";
import { getFugueEnv } from "@/lib/fugue/env";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  requireSession,
  requireWorkspaceForSession,
} from "@/lib/fugue/product-route";
import {
  getNodeKeyPageDataForWorkspace,
  getStoredNodeKeyPageDataForWorkspace,
} from "@/lib/node-keys/service";

export const dynamic = "force-dynamic";

function jsonSnapshot(snapshot: ConsoleApiKeysPageSnapshot) {
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET() {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  try {
    const workspaceState = await requireWorkspaceForSession(session);

    if (workspaceState.response || !workspaceState.workspace) {
      return jsonSnapshot({
        state: "workspace-missing",
      });
    }

    const workspace = workspaceState.workspace;
    const [apiKeys, nodeKeys] = await Promise.all([
      getStoredApiKeyPageDataForWorkspace(session.email, workspace),
      getStoredNodeKeyPageDataForWorkspace(session.email, workspace),
    ]);

    after(async () => {
      try {
        await Promise.all([
          getApiKeyPageDataForWorkspace(session.email, workspace),
          getNodeKeyPageDataForWorkspace(session.email, workspace, {
            ensureCopyableDefault: true,
            includeUsageCounts: false,
          }),
        ]);
      } catch (error) {
        console.error("Console api key snapshot background sync failed.", error);
      }
    });

    return jsonSnapshot({
      apiBaseUrl: getFugueEnv().apiUrl,
      apiKeys,
      nodeKeys,
      state: "ready",
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
