import { NextResponse } from "next/server";

import { deleteApiKeyForEmail, updateApiKeyForEmail } from "@/lib/api-keys/service";
import { getCurrentSession } from "@/lib/auth/session";
import { ensureAppUser } from "@/lib/workspace/store";

type RouteContext = {
  params:
    | Promise<{
        id: string;
      }>
    | {
        id: string;
      };
};

function jsonError(status: number, message: string) {
  return NextResponse.json(
    {
      error: message,
    },
    { status },
  );
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error.";
}

function readErrorStatus(error: unknown) {
  if (!(error instanceof Error)) {
    return 500;
  }

  if (
    error.message.includes("required") ||
    error.message.includes("Nothing to update") ||
    error.message.includes("Choose at least one scope") ||
    error.message.includes("Unsupported scopes") ||
    error.message.includes("cannot be deleted")
  ) {
    return 400;
  }

  if (error.message.includes("not found")) {
    return 404;
  }

  if (error.message.includes("workspace") || error.message.includes("Create a workspace")) {
    return 409;
  }

  const match = error.message.match(/\b(400|401|403|404|409|422|500|502|503)\b/);
  return match ? Number(match[1]) : 500;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readOptionalString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function readScopes(record: Record<string, unknown>) {
  const value = record.scopes;

  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter(
    (scope): scope is string =>
      typeof scope === "string" && scope.trim().length > 0,
  );
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

async function readKeyId(context: RouteContext) {
  const params = await Promise.resolve(context.params);
  return params.id;
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getCurrentSession();

  if (!session) {
    return jsonError(401, "Sign in first.");
  }

  let body: Record<string, unknown>;

  try {
    body = await readJsonObject(request);
  } catch (error) {
    return jsonError(400, readErrorMessage(error));
  }

  const label = Object.prototype.hasOwnProperty.call(body, "label")
    ? readOptionalString(body, "label")
    : undefined;
  const scopes = readScopes(body);

  try {
    await ensureAppUser(session);

    const updated = await updateApiKeyForEmail(
      session.email,
      await readKeyId(context),
      {
        label,
        scopes,
      },
    );

    return NextResponse.json(updated);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getCurrentSession();

  if (!session) {
    return jsonError(401, "Sign in first.");
  }

  try {
    await ensureAppUser(session);

    const deleted = await deleteApiKeyForEmail(
      session.email,
      await readKeyId(context),
    );

    return NextResponse.json(deleted);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
