export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { importFugueUploadApp } from "@/lib/fugue/api";
import {
  prepareLocalUploadArchive,
  readLocalUploadMultipartRequest,
} from "@/lib/fugue/local-upload-server";
import {
  isObject,
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readOptionalString,
} from "@/lib/fugue/product-route";
import {
  readPersistentStorageInput,
  type PersistentStoragePayload,
} from "@/lib/fugue/persistent-storage";
import {
  normalizeImportNetworkMode,
  normalizeImportSourceMode,
} from "@/lib/fugue/import-source";
import {
  ensureAppUser,
  getWorkspaceAccessByEmail,
  saveWorkspaceAccess,
  type WorkspaceAccess,
} from "@/lib/workspace/store";

const ALLOWED_BUILD_STRATEGIES = new Set([
  "auto",
  "static-site",
  "dockerfile",
  "buildpacks",
  "nixpacks",
]);

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

  let multipartRequest;

  try {
    multipartRequest = await readLocalUploadMultipartRequest(request);
  } catch (error) {
    return jsonError(400, readErrorMessage(error));
  }

  const body = multipartRequest.payload;

  if (!isObject(body)) {
    return jsonError(400, "Multipart field payload must be a JSON object.");
  }

  const sourceModeInput = readOptionalString(body, "sourceMode");
  const sourceMode = normalizeImportSourceMode(sourceModeInput || "local-upload") || "local-upload";
  const buildStrategy = readOptionalString(body, "buildStrategy");
  const sourceDir = readOptionalString(body, "sourceDir");
  const dockerfilePath = readOptionalString(body, "dockerfilePath");
  const buildContextDir = readOptionalString(body, "buildContextDir");
  const name = readOptionalString(body, "name");
  const runtimeId = readOptionalString(body, "runtimeId");
  const networkModeInput = readOptionalString(body, "networkMode");
  const networkMode = normalizeImportNetworkMode(networkModeInput);
  const servicePort = readOptionalPositiveInteger(body, "servicePort");
  const startupCommand = readOptionalString(body, "startupCommand");
  let persistentStorage: PersistentStoragePayload | undefined;

  if (sourceModeInput && sourceMode !== "local-upload") {
    return jsonError(400, "Local upload requests must use sourceMode local-upload.");
  }

  if (sourceMode !== "local-upload") {
    return jsonError(400, "Local upload requests must use sourceMode local-upload.");
  }
  if (networkModeInput && !networkMode) {
    return jsonError(400, "Unsupported network mode.");
  }

  if (buildStrategy && !ALLOWED_BUILD_STRATEGIES.has(buildStrategy)) {
    return jsonError(400, "Unsupported build strategy.");
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
    const archive = await prepareLocalUploadArchive(multipartRequest, {
      archiveBaseName: name || null,
      label: multipartRequest.label,
    });
    const result = await importFugueUploadApp(workspace.adminKeySecret, {
      archiveBytes: archive.archiveBytes,
      archiveContentType: archive.archiveContentType,
      archiveName: archive.archiveName,
      buildContextDir: buildContextDir || undefined,
      buildStrategy: buildStrategy || undefined,
      dockerfilePath: dockerfilePath || undefined,
      name: name || undefined,
      persistentStorage,
      projectId: workspace.defaultProjectId ?? undefined,
      runtimeId: runtimeId || undefined,
      networkMode:
        networkMode === "background" ? "background" : undefined,
      servicePort: servicePort ?? undefined,
      startupCommand: startupCommand || undefined,
      sourceDir: sourceDir || undefined,
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
      apps: result.apps,
      composeStack: result.composeStack,
      fugueManifest: result.fugueManifest,
      operation: result.operation,
      operations: result.operations,
      replayed: result.replayed,
      requestInProgress: result.requestInProgress,
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
