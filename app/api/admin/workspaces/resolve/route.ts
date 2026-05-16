import { NextResponse } from "next/server";

import { requireAdminManagementApiSession } from "@/lib/admin/auth";
import { isValidEmail, normalizeEmail } from "@/lib/auth/validation";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
} from "@/lib/fugue/product-route";
import { getWorkspaceSnapshotByEmail } from "@/lib/workspace/store";

export const dynamic = "force-dynamic";

function jsonNoStore(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, {
    status: init?.status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const access = await requireAdminManagementApiSession();

  if (access.response) {
    return access.response;
  }

  try {
    const email = normalizeEmail(
      new URL(request.url).searchParams.get("email") ?? "",
    );

    if (!email || !isValidEmail(email)) {
      return jsonError(400, "Valid email is required.");
    }

    const workspace = await getWorkspaceSnapshotByEmail(email);

    if (!workspace?.tenantId) {
      return jsonError(404, "Workspace not found.");
    }

    return jsonNoStore({
      email,
      workspace: {
        defaultProjectId: workspace.defaultProjectId,
        defaultProjectName: workspace.defaultProjectName,
        firstAppId: workspace.firstAppId,
        tenantId: workspace.tenantId,
        tenantName: workspace.tenantName,
      },
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
