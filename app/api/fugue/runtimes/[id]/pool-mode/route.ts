import { NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin/auth";
import {
  jsonError,
  isObject,
  readErrorMessage,
  readErrorStatus,
  readRouteParam,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";
import { setRuntimePoolModeForEmail } from "@/lib/runtimes/service";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";

type RouteContext = RouteContextWithParams<"id">;

async function readJsonObject(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new Error("400 Invalid JSON body.");
  }

  if (!isObject(body)) {
    throw new Error("400 Request body must be a JSON object.");
  }

  return body;
}

export async function POST(request: Request, context: RouteContext) {
  const access = await requireAdminApiSession();

  if (access.response || !access.session) {
    return access.response;
  }

  let body: Record<string, unknown>;

  try {
    body = await readJsonObject(request);
  } catch (error) {
    return jsonError(400, readErrorMessage(error));
  }

  try {
    await ensureWorkspaceAccess(access.session);
    const runtimeId = await readRouteParam(context, "id");
    const poolMode = typeof body.pool_mode === "string" ? body.pool_mode : "";
    const result = await setRuntimePoolModeForEmail(access.session.email, runtimeId, poolMode);

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
