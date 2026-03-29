import { NextResponse } from "next/server";

import {
  jsonError,
  isObject,
  readErrorMessage,
  readErrorStatus,
  readRouteParam,
  requireSession,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";
import { grantRuntimeShareForEmail } from "@/lib/runtimes/service";
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
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  let body: Record<string, unknown>;

  try {
    body = await readJsonObject(request);
  } catch (error) {
    return jsonError(400, readErrorMessage(error));
  }

  try {
    await ensureWorkspaceAccess(session);
    const runtimeId = await readRouteParam(context, "id");
    const email = typeof body.email === "string" ? body.email : "";
    const sharing = await grantRuntimeShareForEmail(session.email, runtimeId, email);

    return NextResponse.json({ sharing });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
