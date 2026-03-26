import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import {
  isObject,
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readOptionalString,
} from "@/lib/fugue/product-route";
import {
  importFugueGitHubApp,
} from "@/lib/fugue/api";
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

function isGitHubRepoUrl(value: string) {
  return /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+(?:\/)?(?:\.git)?$/i.test(
    value.trim(),
  );
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
  const buildStrategy = readOptionalString(body, "buildStrategy");
  const name = readOptionalString(body, "name");
  const requestedProjectId = readOptionalString(body, "projectId");
  const requestedProjectName = readOptionalString(body, "projectName");
  const runtimeId = readOptionalString(body, "runtimeId");
  const projectName = requestedProjectName || "default";

  if (!repoUrl) {
    return jsonError(400, "Repository link is required.");
  }

  if (!isGitHubRepoUrl(repoUrl)) {
    return jsonError(400, "Only public GitHub repository links are supported.");
  }

  if (buildStrategy && !ALLOWED_BUILD_STRATEGIES.has(buildStrategy)) {
    return jsonError(400, "Unsupported build strategy.");
  }

  try {
    const { workspace } = await ensureWorkspaceAccess(session);
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

    const projectDescription = `${existingProject?.name ?? projectName} project`;
    const result = await importFugueGitHubApp(workspace.adminKeySecret, {
      branch: branch || undefined,
      buildStrategy: buildStrategy || undefined,
      name: name || undefined,
      runtimeId: runtimeId || undefined,
      ...(existingProject
        ? {
            projectId: existingProject.id,
          }
        : {
            project: {
              description: projectDescription,
              name: projectName,
            },
          }),
      repoUrl,
    });
    const resolvedProjectId = existingProject?.id ?? result.app?.projectId ?? null;
    const resolvedProjectName = existingProject?.name ?? projectName;

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
