import { NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin/auth";
import { setAdminClusterNodePolicy } from "@/lib/admin/service";
import {
  isObject,
  jsonError,
  readErrorMessage,
  readOptionalString,
  readRouteParam,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";

type RouteContext = RouteContextWithParams<"name">;

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

function readOptionalBoolean(record: Record<string, unknown>, key: string) {
  if (!Object.prototype.hasOwnProperty.call(record, key)) {
    return undefined;
  }
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new Error(`${key} must be a boolean.`);
  }
  return value;
}

function readErrorStatus(error: unknown) {
  if (!(error instanceof Error)) {
    return 500;
  }

  if (
    error.message.includes("Invalid JSON") ||
    error.message.includes("Request body must be a JSON object") ||
    error.message.includes("must be a boolean") ||
    error.message.includes("at least one policy field")
  ) {
    return 400;
  }

  const match = error.message.match(
    /\b(400|401|403|404|409|422|500|502|503)\b/,
  );
  return match ? Number(match[1]) : 500;
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireAdminApiSession();

  if (access.response) {
    return access.response;
  }

  let body: Record<string, unknown>;

  try {
    body = await readJsonObject(request);
  } catch (error) {
    return jsonError(400, readErrorMessage(error));
  }

  try {
    const node = await setAdminClusterNodePolicy(
      await readRouteParam(context, "name"),
      {
        allowBuilds: readOptionalBoolean(body, "allowBuilds"),
        allowSharedPool: readOptionalBoolean(body, "allowSharedPool"),
        buildTier: Object.prototype.hasOwnProperty.call(body, "buildTier")
          ? readOptionalString(body, "buildTier")
          : undefined,
        desiredControlPlaneRole: Object.prototype.hasOwnProperty.call(
          body,
          "desiredControlPlaneRole",
        )
          ? readOptionalString(body, "desiredControlPlaneRole")
          : undefined,
      },
    );

    return NextResponse.json(node);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
