import { NextResponse } from "next/server";

import { requireAdminManagementRoute } from "@/lib/admin/route";
import {
  buildWorkspaceResolvePayload,
  readWorkspaceResolveEmail,
} from "@/lib/admin/workspace-resolve";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
} from "@/lib/fugue/product-route";
import { getWorkspaceSnapshotByEmail } from "@/lib/workspace/store";

export const dynamic = "force-dynamic";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Vary", "Authorization, Cookie");
  return response;
}

function jsonNoStore(payload: unknown, init?: ResponseInit) {
  return noStore(NextResponse.json(payload, init));
}

function jsonErrorNoStore(status: number, message: string) {
  return noStore(jsonError(status, message));
}

export async function GET(request: Request) {
  const access = await requireAdminManagementRoute(
    request,
    "admin.workspace.resolve.read",
  );

  if (access.response) {
    return noStore(access.response);
  }

  try {
    const email = readWorkspaceResolveEmail(request.url);

    if (!email) {
      return jsonErrorNoStore(400, "Valid email is required.");
    }

    const workspace = await getWorkspaceSnapshotByEmail(email);

    if (!workspace?.tenantId) {
      return jsonErrorNoStore(404, "Workspace not found.");
    }

    return jsonNoStore(buildWorkspaceResolvePayload(email, workspace));
  } catch (error) {
    return jsonErrorNoStore(readErrorStatus(error), readErrorMessage(error));
  }
}
