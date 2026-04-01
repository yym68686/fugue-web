import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { importFugueDockerImageApp } from "@/lib/fugue/api";
import {
  getWorkspaceAccessByEmail,
  saveWorkspaceAccess,
  type WorkspaceAccess,
} from "@/lib/workspace/store";
import { ensureAppUser } from "@/lib/workspace/store";

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

function jsonError(status: number, message: string) {
  return NextResponse.json(
    {
      error: message,
    },
    { status },
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readOptionalString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function readOptionalPositiveInteger(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string" && !value.trim()) {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : Number.NaN;

  return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.NaN;
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

  const imageRef = readOptionalString(body, "imageRef");
  const name = readOptionalString(body, "name");
  const runtimeId = readOptionalString(body, "runtimeId");
  const servicePort = readOptionalPositiveInteger(body, "servicePort");

  if (!imageRef) {
    return jsonError(400, "Image reference is required.");
  }

  if (Number.isNaN(servicePort)) {
    return jsonError(400, "Service port must be a positive integer.");
  }

  try {
    await ensureAppUser(session);
    const existing = await getWorkspaceAccessByEmail(session.email);

    if (!existing) {
      return jsonError(409, "Create a workspace first.");
    }

    const workspace = existing satisfies WorkspaceAccess;
    const result = await importFugueDockerImageApp(workspace.adminKeySecret, {
      imageRef,
      name: name || undefined,
      projectId: workspace.defaultProjectId ?? undefined,
      runtimeId: runtimeId || undefined,
      servicePort: servicePort ?? undefined,
    });

    if (result.app?.id) {
      await saveWorkspaceAccess({
        ...workspace,
        defaultProjectId: workspace.defaultProjectId ?? result.app.projectId,
        defaultProjectName: workspace.defaultProjectName ?? "default",
        firstAppId: workspace.firstAppId ?? result.app.id,
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      app: result.app,
      operation: result.operation,
      replayed: result.replayed,
      requestInProgress: result.requestInProgress,
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
