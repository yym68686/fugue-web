import { NextResponse } from "next/server";

import {
  createApiKeyForEmail,
  getApiKeyPageData,
} from "@/lib/api-keys/service";
import { getCurrentSession } from "@/lib/auth/session";
import { ensureAppUser } from "@/lib/workspace/store";

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
    error.message.includes("workspace") ||
    error.message.includes("Create a workspace")
  ) {
    return 409;
  }

  if (
    error.message.includes("required") ||
    error.message.includes("Choose at least one scope") ||
    error.message.includes("Unsupported scopes")
  ) {
    return 400;
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
    return [];
  }

  return value.filter(
    (scope): scope is string =>
      typeof scope === "string" && scope.trim().length > 0,
  );
}

export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    return jsonError(401, "Sign in first.");
  }

  try {
    await ensureAppUser(session);
    const data = await getApiKeyPageData(session.email);

    if (!data) {
      return jsonError(409, "Create a workspace first.");
    }

    return NextResponse.json(data);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session) {
    return jsonError(401, "Sign in first.");
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

  try {
    await ensureAppUser(session);

    const created = await createApiKeyForEmail(session.email, {
      label: readOptionalString(body, "label"),
      scopes: readScopes(body),
    });

    return NextResponse.json({
      key: created.key,
      secret: created.secret,
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
