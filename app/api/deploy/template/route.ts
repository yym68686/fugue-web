import { randomBytes, randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import type { FugueGitHubTemplateInspection } from "@/lib/fugue/api";
import { importFugueGitHubApp, inspectGitHubTemplate } from "@/lib/fugue/api";
import { getFugueEnv } from "@/lib/fugue/env";
import {
  readPersistentStorageInput,
  type PersistentStoragePayload,
} from "@/lib/fugue/persistent-storage";
import {
  isObject,
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readOptionalString,
} from "@/lib/fugue/product-route";
import {
  BUILD_STRATEGY_OPTIONS,
  normalizeImportNetworkMode,
  preservesGitHubTopologyImport,
} from "@/lib/fugue/import-source";
import {
  buildPersistentStorageSeedFileKey,
  collectInspectionPersistentStorageSeedFileKeys,
} from "@/lib/fugue/template-inspection";
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

const ALLOWED_BUILD_STRATEGIES = new Set<string>(
  BUILD_STRATEGY_OPTIONS.map((option) => option.value),
);

type PersistentStorageSeedFileInput = {
  path: string;
  seedContent: string;
  service: string;
};

function readStringMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, string>;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) =>
      typeof entry === "string" ? [[key, entry]] : [],
    ),
  );
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

function generateTemplateValue(generate: string) {
  const normalized = generate.trim().toLowerCase();

  switch (normalized) {
    case "uuid":
      return randomUUID();
    case "hex":
      return randomBytes(24).toString("hex");
    case "password":
    case "secret":
    case "token":
    default:
      return randomBytes(24).toString("base64url");
  }
}

function resolveTemplateEnv(
  inspection: FugueGitHubTemplateInspection | null,
  rawValues: Record<string, string>,
) {
  const resolved = {} as Record<string, string>;
  const variables = inspection?.template?.variables ?? [];

  for (const variable of variables) {
    const explicitValue = rawValues[variable.key]?.trim() ?? "";

    if (explicitValue) {
      resolved[variable.key] = explicitValue;
      continue;
    }

    if (variable.defaultValue) {
      resolved[variable.key] = variable.defaultValue;
      continue;
    }

    if (variable.generate) {
      resolved[variable.key] = generateTemplateValue(variable.generate);
      continue;
    }

    if (variable.required) {
      throw new Error(`${variable.label || variable.key} is required.`);
    }
  }

  return Object.keys(resolved).length > 0 ? resolved : undefined;
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
  const branch = readOptionalString(body, "branch");
  const name = readOptionalString(body, "name");
  const runtimeId = readOptionalString(body, "runtimeId");
  const networkModeInput = readOptionalString(body, "networkMode");
  const networkMode = normalizeImportNetworkMode(networkModeInput);
  const projectId = readOptionalString(body, "projectId");
  const projectName = readOptionalString(body, "projectName");
  const projectMode = readOptionalString(body, "projectMode");
  const templateSlug = readOptionalString(body, "templateSlug");
  const buildStrategy = readOptionalString(body, "buildStrategy");
  const sourceDir = readOptionalString(body, "sourceDir");
  const dockerfilePath = readOptionalString(body, "dockerfilePath");
  const buildContextDir = readOptionalString(body, "buildContextDir");
  const startupCommand = readOptionalString(body, "startupCommand");
  let persistentStorage: PersistentStoragePayload | undefined;
  const repoVisibilityInput = readOptionalString(body, "repoVisibility");
  const repoVisibility = normalizeGitHubRepoVisibility(repoVisibilityInput);
  const repoAuthToken = readOptionalString(body, "repoAuthToken");
  const resolvedRepoVisibility = resolveGitHubRepoVisibility(
    repoVisibilityInput,
    Boolean(repoAuthToken),
  );
  let persistentStorageSeedFiles: PersistentStorageSeedFileInput[];

  try {
    persistentStorage = readPersistentStorageInput(body.persistentStorage);
    persistentStorageSeedFiles = readPersistentStorageSeedFiles(
      body.persistentStorageSeedFiles,
    );
  } catch (error) {
    return jsonError(400, readErrorMessage(error));
  }

  if (!repoUrl) {
    return jsonError(400, "Repository link is required.");
  }
  if (networkModeInput && !networkMode) {
    return jsonError(400, "Unsupported network mode.");
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

  try {
    const { workspace } = await ensureWorkspaceAccess(session);
    const repoAccess = await resolveGitHubRepoAuthTokenForEmail(session.email, {
      explicitToken: repoAuthToken,
      repoVisibility: resolvedRepoVisibility,
    });

    if (resolvedRepoVisibility === "private" && !repoAccess.token) {
      return jsonError(400, PRIVATE_GITHUB_AUTH_REQUIRED_MESSAGE);
    }

    const inspection = await inspectGitHubTemplate(getFugueEnv().bootstrapKey, {
      branch: branch || undefined,
      repoAuthToken: repoAccess.token || undefined,
      repoUrl,
      repoVisibility: resolvedRepoVisibility,
    });

    if (templateSlug && inspection.template?.slug && inspection.template.slug !== templateSlug) {
      return jsonError(409, "Template metadata changed. Reload the page and try again.");
    }

    if (templateSlug && !inspection.template) {
      return jsonError(409, "This repository no longer exposes template metadata.");
    }

    const preservesTopologyImport =
      Boolean(inspection.fugueManifest) ||
      (Boolean(inspection.composeStack) &&
        preservesGitHubTopologyImport({
          buildContextDir,
          buildStrategy,
          dockerfilePath,
          sourceDir,
        }));

    if (persistentStorage && preservesTopologyImport) {
      return jsonError(
        400,
        "Manual persistent storage mounts only work for single-app deploys. Clear the mounts or switch away from topology import.",
      );
    }

    if (persistentStorageSeedFiles.length > 0) {
      if (!inspection.fugueManifest && !inspection.composeStack) {
        return jsonError(
          409,
          "This repository no longer exposes editable persistent storage files.",
        );
      }

      const availableSeedFiles =
        collectInspectionPersistentStorageSeedFileKeys(inspection);

      for (const file of persistentStorageSeedFiles) {
        if (
          !availableSeedFiles.has(
            buildPersistentStorageSeedFileKey(file.service, file.path),
          )
        ) {
          return jsonError(
            409,
            "Persistent storage files changed. Reload the page and try again.",
          );
        }
      }
    }

    const createProject = !projectId && projectMode === "create";
    const requestedProjectId = createProject
      ? ""
      : projectId || workspace.defaultProjectId || "";
    const requestedProjectName = createProject
      ? projectName || "default"
      : projectName || workspace.defaultProjectName || "default";
    const existingProject = requestedProjectId
      ? await findWorkspaceProjectById(
          workspace.adminKeySecret,
          requestedProjectId,
          workspace.tenantId ?? undefined,
        )
      : await findWorkspaceProjectByName(
          workspace.adminKeySecret,
          requestedProjectName,
          workspace.tenantId ?? undefined,
        );

    if (projectId && !existingProject) {
      return jsonError(404, "Project not found.");
    }

    if (createProject && existingProject) {
      return jsonError(409, DUPLICATE_PROJECT_NAME_MESSAGE);
    }

    const resolvedExistingProject = createProject ? null : existingProject;
    const resolvedProjectName =
      resolvedExistingProject?.name ?? requestedProjectName;
    const projectPayload = resolvedExistingProject
      ? {
          projectId: resolvedExistingProject.id,
        }
      : {
          project: {
            description: `${resolvedProjectName} project`,
            name: resolvedProjectName,
          },
        };
    const templateEnv = resolveTemplateEnv(
      inspection,
      readStringMap(body.variables),
    );
    const rawEnv = readStringMap(body.env);
    const env =
      templateEnv || Object.keys(rawEnv).length > 0
        ? {
            ...(templateEnv ?? {}),
            ...rawEnv,
          }
        : undefined;
    const result = await importFugueGitHubApp(workspace.adminKeySecret, {
      branch: branch || undefined,
      ...(inspection.fugueManifest
        ? {}
        : {
            buildContextDir: buildContextDir || undefined,
            buildStrategy: buildStrategy || undefined,
            dockerfilePath: dockerfilePath || undefined,
            sourceDir: sourceDir || undefined,
          }),
      env,
      name: name || undefined,
      persistentStorage,
      persistentStorageSeedFiles:
        persistentStorageSeedFiles.length > 0
          ? persistentStorageSeedFiles
          : undefined,
      repoAuthToken: repoAccess.token || undefined,
      repoUrl,
      repoVisibility: resolvedRepoVisibility,
      runtimeId: runtimeId || undefined,
      networkMode:
        networkMode && networkMode !== "public" ? networkMode : undefined,
      startupCommand: startupCommand || undefined,
      ...projectPayload,
    });

    if (result.app?.id) {
      await saveWorkspaceAccess({
        ...workspace,
        defaultProjectId: workspace.defaultProjectId ?? result.app.projectId,
        defaultProjectName: workspace.defaultProjectName ?? resolvedProjectName,
        firstAppId: workspace.firstAppId ?? result.app.id,
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      app: result.app,
      operation: result.operation,
      redirectTo: "/app",
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
