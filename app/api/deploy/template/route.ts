import { randomBytes, randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import type { FugueGitHubTemplateInspection } from "@/lib/fugue/api";
import { importFugueGitHubApp, inspectGitHubTemplate } from "@/lib/fugue/api";
import { getFugueEnv } from "@/lib/fugue/env";
import {
  isObject,
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readOptionalString,
} from "@/lib/fugue/product-route";
import { BUILD_STRATEGY_OPTIONS } from "@/lib/fugue/import-source";
import {
  isGitHubRepoUrl,
  normalizeGitHubRepoVisibility,
  resolveGitHubRepoVisibility,
} from "@/lib/github/repository";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";
import {
  findWorkspaceProjectById,
  findWorkspaceProjectByName,
} from "@/lib/workspace/projects";
import { saveWorkspaceAccess } from "@/lib/workspace/store";

const ALLOWED_BUILD_STRATEGIES = new Set<string>(
  BUILD_STRATEGY_OPTIONS.map((option) => option.value),
);

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
  const projectId = readOptionalString(body, "projectId");
  const projectName = readOptionalString(body, "projectName");
  const templateSlug = readOptionalString(body, "templateSlug");
  const buildStrategy = readOptionalString(body, "buildStrategy");
  const sourceDir = readOptionalString(body, "sourceDir");
  const dockerfilePath = readOptionalString(body, "dockerfilePath");
  const buildContextDir = readOptionalString(body, "buildContextDir");
  const repoVisibilityInput = readOptionalString(body, "repoVisibility");
  const repoVisibility = normalizeGitHubRepoVisibility(repoVisibilityInput);
  const repoAuthToken = readOptionalString(body, "repoAuthToken");
  const resolvedRepoVisibility = resolveGitHubRepoVisibility(
    repoVisibilityInput,
    Boolean(repoAuthToken),
  );

  if (!repoUrl) {
    return jsonError(400, "Repository link is required.");
  }

  if (!isGitHubRepoUrl(repoUrl)) {
    return jsonError(400, "GitHub repository links must use https://github.com/owner/repo.");
  }

  if (repoVisibilityInput && !repoVisibility) {
    return jsonError(400, "Repository access must be public or private.");
  }

  if (resolvedRepoVisibility === "private" && !repoAuthToken) {
    return jsonError(
      400,
      "Private GitHub repositories require a GitHub token with repository read access.",
    );
  }

  if (buildStrategy && !ALLOWED_BUILD_STRATEGIES.has(buildStrategy)) {
    return jsonError(400, "Unsupported build strategy.");
  }

  try {
    const { workspace } = await ensureWorkspaceAccess(session);
    const inspection = await inspectGitHubTemplate(getFugueEnv().bootstrapKey, {
      branch: branch || undefined,
      repoAuthToken: repoAuthToken || undefined,
      repoUrl,
      repoVisibility: resolvedRepoVisibility,
    });

    if (templateSlug && inspection.template?.slug && inspection.template.slug !== templateSlug) {
      return jsonError(409, "Template metadata changed. Reload the page and try again.");
    }

    if (templateSlug && !inspection.template) {
      return jsonError(409, "This repository no longer exposes template metadata.");
    }

    const requestedProjectId = projectId || workspace.defaultProjectId || "";
    const requestedProjectName = projectName || workspace.defaultProjectName || "default";
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

    const resolvedProjectName = existingProject?.name ?? requestedProjectName;
    const projectPayload = existingProject
      ? {
          projectId: existingProject.id,
        }
      : {
          project: {
            description: `${resolvedProjectName} project`,
            name: resolvedProjectName,
          },
        };
    const env = resolveTemplateEnv(inspection, readStringMap(body.variables));
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
      repoAuthToken: repoAuthToken || undefined,
      repoUrl,
      repoVisibility: resolvedRepoVisibility,
      runtimeId: runtimeId || undefined,
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
