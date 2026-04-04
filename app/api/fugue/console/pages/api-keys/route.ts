import { NextResponse } from "next/server";

import type { ConsoleApiKeysPageSnapshot } from "@/lib/console/page-snapshot-types";
import { getApiKeyPageData } from "@/lib/api-keys/service";
import { getFugueEnv } from "@/lib/fugue/env";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  requireSession,
} from "@/lib/fugue/product-route";
import { getNodeKeyPageData } from "@/lib/node-keys/service";

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
    const [apiKeys, nodeKeys] = await Promise.all([
      getApiKeyPageData(session.email),
      getNodeKeyPageData(session.email, {
        ensureCopyableDefault: true,
      }),
    ]);

    if (!apiKeys || !nodeKeys) {
      return jsonSnapshot({
        state: "workspace-missing",
      });
    }

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
