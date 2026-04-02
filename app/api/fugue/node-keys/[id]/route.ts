import { NextResponse } from "next/server";

import { renameNodeKeyForEmail } from "@/lib/node-keys/service";
import {
  isObject,
  jsonError,
  readErrorMessage,
  readOptionalString,
  readRouteParam,
  requireSession,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";

function readErrorStatus(error: unknown) {
  if (!(error instanceof Error)) {
    return 500;
  }

  if (
    error.message.includes("required") ||
    error.message.includes("Nothing to update") ||
    error.message.includes("cannot be renamed")
  ) {
    return 400;
  }

  if (error.message.includes("not found")) {
    return 404;
  }

  if (
    error.message.includes("workspace") ||
    error.message.includes("Create a workspace")
  ) {
    return 409;
  }

  const match = error.message.match(/\b(400|401|403|404|409|422|500|502|503)\b/);
  return match ? Number(match[1]) : 500;
}

async function readJsonObject(request: Request) {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return {} as Record<string, unknown>;
  }

  let body: unknown;

  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new Error("Invalid JSON body.");
  }

  if (!isObject(body)) {
    throw new Error("Request body must be a JSON object.");
  }

  return body;
}

export async function PATCH(
  request: Request,
  context: RouteContextWithParams<"id">,
) {
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
    const updated = await renameNodeKeyForEmail(
      session.email,
      await readRouteParam(context, "id"),
      {
        label: readOptionalString(body, "label"),
      },
    );

    return NextResponse.json(updated);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
