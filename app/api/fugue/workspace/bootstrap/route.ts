import { NextResponse } from "next/server";

import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
} from "@/lib/fugue/product-route";
import { getCurrentSession } from "@/lib/auth/session";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";

export async function POST() {
  const session = await getCurrentSession();

  if (!session) {
    return jsonError(401, "Sign in first.");
  }

  try {
    const result = await ensureWorkspaceAccess(session);
    const { adminKeySecret: _adminKeySecret, ...workspace } = result.workspace;

    return NextResponse.json({
      created: result.created,
      workspace,
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
