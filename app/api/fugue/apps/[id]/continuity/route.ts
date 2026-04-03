import { NextResponse } from "next/server";

import { patchFugueAppContinuity } from "@/lib/fugue/api";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readRouteParam,
  requireSession,
  requireWorkspaceForSession,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";

type RouteContext = RouteContextWithParams<"id">;

function asRecord(value: unknown) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readOptionalString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readBoolean(record: Record<string, unknown> | null, key: string) {
  return typeof record?.[key] === "boolean" ? (record[key] as boolean) : undefined;
}

function readContinuityTarget(record: Record<string, unknown> | null, key: string) {
  const section = asRecord(record?.[key]);
  const enabled = readBoolean(section, "enabled");

  if (enabled === undefined) {
    return undefined;
  }

  return {
    enabled,
    targetRuntimeId: readOptionalString(section, "targetRuntimeId"),
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  const workspaceState = await requireWorkspaceForSession(session);

  if (workspaceState.response || !workspaceState.workspace) {
    return workspaceState.response;
  }

  try {
    const appId = await readRouteParam(context, "id");
    const body = asRecord(await request.json().catch(() => null));
    const result = await patchFugueAppContinuity(
      workspaceState.workspace.adminKeySecret,
      appId,
      {
        appFailover: readContinuityTarget(body, "appFailover"),
        databaseFailover: readContinuityTarget(body, "databaseFailover"),
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
