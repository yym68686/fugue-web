import { NextResponse } from "next/server";

import { getConsoleRuntimeTargetInventoryData } from "@/lib/console/gallery-data";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  requireSession,
  requireWorkspaceForSession,
} from "@/lib/fugue/product-route";
import { getRequestLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  const workspaceState = await requireWorkspaceForSession(session);

  if (workspaceState.response || !workspaceState.workspace) {
    return workspaceState.response;
  }

  try {
    const locale = await getRequestLocale();
    const data = await getConsoleRuntimeTargetInventoryData(locale);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
