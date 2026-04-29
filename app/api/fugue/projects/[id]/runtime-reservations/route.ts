import { NextResponse } from "next/server";

import {
  listFugueProjectRuntimeReservations,
  reserveFugueProjectRuntime,
} from "@/lib/fugue/api";
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
  return typeof value === "string" ? value : undefined;
}

export async function GET(_request: Request, context: RouteContext) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  const workspaceState = await requireWorkspaceForSession(session);

  if (workspaceState.response || !workspaceState.workspace) {
    return workspaceState.response;
  }

  try {
    const projectId = await readRouteParam(context, "id");
    const reservations = await listFugueProjectRuntimeReservations(
      workspaceState.workspace.adminKeySecret,
      projectId,
    );

    return NextResponse.json({ runtimeReservations: reservations });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  const workspaceState = await requireWorkspaceForSession(session);

  if (workspaceState.response || !workspaceState.workspace) {
    return workspaceState.response;
  }

  try {
    const projectId = await readRouteParam(context, "id");
    const body = asRecord(await request.json().catch(() => null));
    const runtimeId = readOptionalString(body, "runtimeId");

    if (!runtimeId) {
      return jsonError(400, "runtimeId is required");
    }

    const reservation = await reserveFugueProjectRuntime(
      workspaceState.workspace.adminKeySecret,
      projectId,
      runtimeId,
    );

    return NextResponse.json(
      { runtimeReservation: reservation },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
