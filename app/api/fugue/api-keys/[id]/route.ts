import { NextResponse } from "next/server";

import {
  getApiKeyRecordById,
  setApiKeyStatus,
} from "@/lib/api-keys/store";
import { getCurrentSession } from "@/lib/auth/session";
import { ensureAppUser } from "@/lib/workspace/store";

type RouteContext = {
  params: Promise<{
    id: string;
  }> | {
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

async function readKeyId(context: RouteContext) {
  const params = await Promise.resolve(context.params);
  return params.id;
}

export async function PATCH(request: Request, context: RouteContext) {
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

  const action = readOptionalString(body, "action");

  if (action !== "disable" && action !== "enable") {
    return jsonError(400, "Action must be disable or enable.");
  }

  try {
    await ensureAppUser(session);

    const keyId = await readKeyId(context);
    const record = await getApiKeyRecordById(session.email, keyId, {
      includeDeleted: true,
    });

    if (!record) {
      return jsonError(404, "API key not found.");
    }

    if (record.isWorkspaceAdmin) {
      return jsonError(409, "Workspace admin key cannot be disabled here.");
    }

    if (record.status === "deleted") {
      return jsonError(409, "Deleted keys cannot be changed.");
    }

    const updated = await setApiKeyStatus(
      session.email,
      keyId,
      action === "disable" ? "disabled" : "active",
    );

    if (!updated) {
      return jsonError(404, "API key not found.");
    }

    return NextResponse.json({
      key: updated,
      localOnly: true,
    });
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

    const keyId = await readKeyId(context);
    const record = await getApiKeyRecordById(session.email, keyId, {
      includeDeleted: true,
    });

    if (!record) {
      return jsonError(404, "API key not found.");
    }

    if (record.isWorkspaceAdmin) {
      return jsonError(409, "Workspace admin key cannot be deleted here.");
    }

    if (record.status === "deleted") {
      return NextResponse.json({
        key: record,
        localOnly: true,
      });
    }

    const updated = await setApiKeyStatus(session.email, keyId, "deleted");

    if (!updated) {
      return jsonError(404, "API key not found.");
    }

    return NextResponse.json({
      key: updated,
      localOnly: true,
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
