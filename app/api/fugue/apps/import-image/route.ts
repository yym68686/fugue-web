import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { importFugueDockerImageApp } from "@/lib/fugue/api";
import { normalizeImportNetworkMode } from "@/lib/fugue/import-source";
import { readStringMap } from "@/lib/fugue/product-route";
import {
  readPersistentStorageInput,
  type PersistentStoragePayload,
} from "@/lib/fugue/persistent-storage";
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
  const networkModeInput = readOptionalString(body, "networkMode");
  const networkMode = normalizeImportNetworkMode(networkModeInput);
  const servicePort = readOptionalPositiveInteger(body, "servicePort");
  const startupCommand = readOptionalString(body, "startupCommand");
  const env = readStringMap(body.env);
  let persistentStorage: PersistentStoragePayload | undefined;

  if (!imageRef) {
    return jsonError(400, "Image reference is required.");
  }
  if (networkModeInput && !networkMode) {
    return jsonError(400, "Unsupported network mode.");
  }

  if (Number.isNaN(servicePort)) {
    return jsonError(400, "Service port must be a positive integer.");
  }

  try {
    persistentStorage = readPersistentStorageInput(body.persistentStorage);
  } catch (error) {
    return jsonError(400, readErrorMessage(error));
  }

  try {
    await ensureAppUser(session);
    const existing = await getWorkspaceAccessByEmail(session.email);

    if (!existing) {
      return jsonError(409, "Create a workspace first.");
    }

    const workspace = existing satisfies WorkspaceAccess;
    const result = await importFugueDockerImageApp(workspace.adminKeySecret, {
      ...(Object.keys(env).length > 0 ? { env } : {}),
      imageRef,
      name: name || undefined,
      persistentStorage,
      projectId: workspace.defaultProjectId ?? undefined,
      runtimeId: runtimeId || undefined,
      networkMode:
        networkMode === "background" ? "background" : undefined,
      servicePort: servicePort ?? undefined,
      startupCommand: startupCommand || undefined,
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
