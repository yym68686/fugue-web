import { NextResponse } from "next/server";

import { createFugueHostedDNSZone, getFugueHostedDNSZones } from "@/lib/fugue/api";
import {
  isObject,
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readOptionalString,
  requireSession,
  requireWorkspaceForSession,
} from "@/lib/fugue/product-route";

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
    return NextResponse.json(
      await getFugueHostedDNSZones(workspaceState.workspace.adminKeySecret),
    );
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}

export async function POST(request: Request) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  const workspaceState = await requireWorkspaceForSession(session);

  if (workspaceState.response || !workspaceState.workspace) {
    return workspaceState.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  if (!isObject(body)) {
    return jsonError(400, "Request body must be a JSON object.");
  }

  const zoneName =
    readOptionalString(body, "zoneName") || readOptionalString(body, "zone_name");

  if (!zoneName) {
    return jsonError(400, "zoneName is required.");
  }

  try {
    return NextResponse.json(
      await createFugueHostedDNSZone(workspaceState.workspace.adminKeySecret, {
        zoneName,
      }),
    );
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
