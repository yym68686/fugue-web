import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import {
  isObject,
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readOptionalString,
  readStringMap,
} from "@/lib/fugue/product-route";
import {
  importFugueDockerImageApp,
  importFugueGitHubApp,
} from "@/lib/fugue/api";
import {
  readPersistentStorageInput,
  type PersistentStoragePayload,
} from "@/lib/fugue/persistent-storage";
import {
  normalizeImportSourceMode,
  preservesGitHubTopologyImport,
} from "@/lib/fugue/import-source";
import {
  isGitHubRepoUrl,
  normalizeGitHubRepoVisibility,
  resolveGitHubRepoVisibility,
} from "@/lib/github/repository";
import {
  resolveGitHubRepoAuthTokenForEmail,
} from "@/lib/github/connection-store";
import { PRIVATE_GITHUB_AUTH_REQUIRED_MESSAGE } from "@/lib/github/messages";
import { DUPLICATE_PROJECT_NAME_MESSAGE } from "@/lib/project-names";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";
import {
  findWorkspaceProjectById,
  findWorkspaceProjectByName,
} from "@/lib/workspace/projects";
import { saveWorkspaceAccess } from "@/lib/workspace/store";

const ALLOWED_BUILD_STRATEGIES = new Set([
  "auto",
  "static-site",
  "dockerfile",
  "buildpacks",
  "nixpacks",
]);

type PersistentStorageSeedFileInput = {
  path: string;
  seedContent: string;
  service: string;
};

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

function readPersistentStorageSeedFiles(value: unknown) {
  if (value === undefined) {
    return [] as PersistentStorageSeedFileInput[];
  }

  if (!Array.isArray(value)) {
    throw new Error("Persistent storage files must be an array.");
  }

  return value.map((entry, index) => {
    if (!isObject(entry)) {
      throw new Error(
        `Persistent storage file ${index + 1} must be an object.`,
      );
    }

    const service =
      typeof entry.service === "string" ? entry.service.trim() : "";
    const path = typeof entry.path === "string" ? entry.path.trim() : "";
    const seedContent =
      typeof entry.seedContent === "string" ? entry.seedContent : "";

    if (!service) {
      throw new Error(
        `Persistent storage file ${index + 1} is missing a service.`,
      );
    }

    if (!path) {
      throw new Error(
        `Persistent storage file ${index + 1} is missing a path.`,
      );
    }

    if (
      entry.seedContent !== undefined &&
      typeof entry.seedContent !== "string"
    ) {
      throw new Error(
        `Persistent storage file ${index + 1} must use text content.`,
      );
    }

    return {
      path,
      seedContent,
      service,
    };
  });
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

  const repoUrl = readOptionalString(body, "repoUrl");
  const imageRef = readOptionalString(body, "imageRef");
  const branch = readOptionalString(body, "branch");
  const buildStrategy = readOptionalString(body, "buildStrategy");
  const sourceDir = readOptionalString(body, "sourceDir");
  const dockerfilePath = readOptionalString(body, "dockerfilePath");
  const buildContextDir = readOptionalString(body, "buildContextDir");
  const name = readOptionalString(body, "name");
  const sourceModeInput = readOptionalString(body, "sourceMode");
  const sourceMode = normalizeImportSourceMode(sourceModeInput || "github") || "github";
  const requestedProjectId = readOptionalString(body, "projectId");
  const requestedProjectName = readOptionalString(body, "projectName");
  const projectMode = readOptionalString(body, "projectMode");
  const runtimeId = readOptionalString(body, "runtimeId");
  const servicePort = readOptionalPositiveInteger(body, "servicePort");
  const startupCommand = readOptionalString(body, "startupCommand");
  const env = readStringMap(body.env);
  let persistentStorage: PersistentStoragePayload | undefined;
  const repoVisibilityInput = readOptionalString(body, "repoVisibility");
  const repoVisibility = normalizeGitHubRepoVisibility(repoVisibilityInput);
  const repoAuthToken = readOptionalString(body, "repoAuthToken");
  const resolvedRepoVisibility = resolveGitHubRepoVisibility(
    repoVisibilityInput,
    Boolean(repoAuthToken),
  );
  const projectName = requestedProjectName || "default";
  let persistentStorageSeedFiles: PersistentStorageSeedFileInput[];

  try {
    persistentStorage = readPersistentStorageInput(body.persistentStorage);
    persistentStorageSeedFiles = readPersistentStorageSeedFiles(
      body.persistentStorageSeedFiles,
    );
  } catch (error) {
    return jsonError(400, readErrorMessage(error));
  }

  if (sourceModeInput && !normalizeImportSourceMode(sourceModeInput)) {
    return jsonError(400, "Unsupported import source.");
  }

  if (sourceMode === "local-upload") {
    return jsonError(400, "Local uploads must use the multipart upload endpoint.");
  }

  if (sourceMode === "github") {
    if (!repoUrl) {
      return jsonError(400, "Repository link is required.");
    }

    if (!isGitHubRepoUrl(repoUrl)) {
      return jsonError(400, "GitHub repository links must use https://github.com/owner/repo.");
    }

    if (repoVisibilityInput && !repoVisibility) {
      return jsonError(400, "Repository access must be public or private.");
    }

    if (buildStrategy && !ALLOWED_BUILD_STRATEGIES.has(buildStrategy)) {
      return jsonError(400, "Unsupported build strategy.");
    }

    if (
      persistentStorageSeedFiles.length > 0 &&
      !preservesGitHubTopologyImport({
        buildContextDir,
        buildStrategy,
        dockerfilePath,
        sourceDir,
      })
    ) {
      return jsonError(
        400,
        "Persistent storage files require auto-detected topology import. Clear manual build overrides and try again.",
      );
    }
  } else if (!imageRef) {
    return jsonError(400, "Image reference is required.");
  }

  if (Number.isNaN(servicePort)) {
    return jsonError(400, "Service port must be a positive integer.");
  }

  try {
    const { workspace } = await ensureWorkspaceAccess(session);
    const repoAccess =
      sourceMode === "github"
        ? await resolveGitHubRepoAuthTokenForEmail(session.email, {
            explicitToken: repoAuthToken,
            repoVisibility: resolvedRepoVisibility,
          })
        : null;
    const createProject = !requestedProjectId && projectMode === "create";

    if (
      sourceMode === "github" &&
      resolvedRepoVisibility === "private" &&
      !repoAccess?.token
    ) {
      return jsonError(400, PRIVATE_GITHUB_AUTH_REQUIRED_MESSAGE);
    }

    const existingProject = requestedProjectId
      ? await findWorkspaceProjectById(
          workspace.adminKeySecret,
          requestedProjectId,
          workspace.tenantId ?? undefined,
        )
      : await findWorkspaceProjectByName(
          workspace.adminKeySecret,
          projectName,
          workspace.tenantId ?? undefined,
        );

    if (requestedProjectId && !existingProject) {
      return jsonError(404, "Project not found.");
    }

    if (createProject && existingProject) {
      return jsonError(409, DUPLICATE_PROJECT_NAME_MESSAGE);
    }

    const resolvedExistingProject = createProject ? null : existingProject;

    const projectDescription = `${resolvedExistingProject?.name ?? projectName} project`;
    const projectPayload = resolvedExistingProject
      ? {
          projectId: resolvedExistingProject.id,
        }
      : {
          project: {
            description: projectDescription,
            name: projectName,
          },
        };
    const result =
      sourceMode === "github"
        ? await importFugueGitHubApp(workspace.adminKeySecret, {
            branch: branch || undefined,
            buildStrategy: buildStrategy || undefined,
            buildContextDir: buildContextDir || undefined,
            dockerfilePath: dockerfilePath || undefined,
            ...(Object.keys(env).length > 0 ? { env } : {}),
            name: name || undefined,
            persistentStorage,
            persistentStorageSeedFiles:
              persistentStorageSeedFiles.length > 0
                ? persistentStorageSeedFiles
                : undefined,
            repoAuthToken: repoAccess?.token || undefined,
            runtimeId: runtimeId || undefined,
            repoVisibility: resolvedRepoVisibility,
            servicePort: servicePort ?? undefined,
            startupCommand: startupCommand || undefined,
            sourceDir: sourceDir || undefined,
            ...projectPayload,
            repoUrl,
          })
        : await importFugueDockerImageApp(workspace.adminKeySecret, {
            ...(Object.keys(env).length > 0 ? { env } : {}),
            imageRef,
            name: name || undefined,
            persistentStorage,
            runtimeId: runtimeId || undefined,
            servicePort: servicePort ?? undefined,
            startupCommand: startupCommand || undefined,
            ...projectPayload,
          });
    const resolvedProjectId = resolvedExistingProject?.id ?? result.app?.projectId ?? null;
    const resolvedProjectName = resolvedExistingProject?.name ?? projectName;

    if (result.app?.id) {
      await saveWorkspaceAccess({
        ...workspace,
        defaultProjectId: workspace.defaultProjectId ?? resolvedProjectId,
        defaultProjectName: workspace.defaultProjectName ?? resolvedProjectName,
        firstAppId: workspace.firstAppId ?? result.app.id,
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      app: result.app,
      operation: result.operation,
      project: resolvedProjectId
        ? {
            id: resolvedProjectId,
            name: resolvedProjectName,
          }
        : null,
      replayed: result.replayed,
      requestInProgress: result.requestInProgress,
      workspace: {
        defaultProjectId: workspace.defaultProjectId ?? resolvedProjectId,
        defaultProjectName: workspace.defaultProjectName ?? resolvedProjectName,
        tenantId: workspace.tenantId,
        tenantName: workspace.tenantName,
      },
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
