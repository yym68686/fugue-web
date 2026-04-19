import { NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin/auth";
import { createAdminPlatformNodeEnrollment } from "@/lib/admin/service";
import {
  isObject,
  jsonError,
  readErrorMessage,
  readOptionalString,
} from "@/lib/fugue/product-route";

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

function readErrorStatus(error: unknown) {
  if (!(error instanceof Error)) {
    return 500;
  }

  if (
    error.message.includes("Invalid JSON") ||
    error.message.includes("Request body must be a JSON object")
  ) {
    return 400;
  }

  const match = error.message.match(
    /\b(400|401|403|404|409|422|500|502|503)\b/,
  );
  return match ? Number(match[1]) : 500;
}

export async function POST(request: Request) {
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
    const result = await createAdminPlatformNodeEnrollment({
      label: Object.prototype.hasOwnProperty.call(body, "label")
        ? (readOptionalString(body, "label") ?? undefined)
        : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
