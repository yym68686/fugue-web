import { NextResponse } from "next/server";

import {
  createDefaultNodeKeyForEmail,
  createNodeKeyForEmail,
  getNodeKeyPageData,
} from "@/lib/node-keys/service";
import {
  isObject,
  jsonError,
  readErrorMessage,
  readOptionalString,
  requireSession,
} from "@/lib/fugue/product-route";

function readErrorStatus(error: unknown) {
  if (!(error instanceof Error)) {
    return 500;
  }

  if (
    error.message.includes("required") ||
    error.message.includes("Invalid JSON") ||
    error.message.includes("Request body must be a JSON object")
  ) {
    return 400;
  }

  if (
    error.message.includes("workspace") ||
    error.message.includes("Create a workspace")
  ) {
    return 409;
  }

  if (error.message.includes("not found")) {
    return 404;
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

export async function GET() {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  try {
    const data = await getNodeKeyPageData(session.email);

    if (!data) {
      return jsonError(409, "Create a workspace first.");
    }

    return NextResponse.json(data);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}

export async function POST(request: Request) {
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
    const label = Object.prototype.hasOwnProperty.call(body, "label")
      ? readOptionalString(body, "label")
      : undefined;
    const created =
      label !== undefined
        ? await createNodeKeyForEmail(session.email, { label })
        : await createDefaultNodeKeyForEmail(session.email);

    return NextResponse.json({
      key: created.key,
      secret: created.secret,
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
