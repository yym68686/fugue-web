import "server-only";

import type { ConsoleImportRuntimeTargetView } from "@/lib/console/gallery-types";
import type {
  FugueGitHubTemplateInspection,
  FugueProject,
} from "@/lib/fugue/api";
import {
  getFugueProjects,
  getFugueRuntimes,
  inspectGitHubTemplate,
} from "@/lib/fugue/api";
import { getFugueEnv } from "@/lib/fugue/env";
import {
  resolveGitHubRepoAuthTokenForEmail,
} from "@/lib/github/connection-store";
import { PRIVATE_GITHUB_AUTH_REQUIRED_MESSAGE } from "@/lib/github/messages";
import { isGitHubRepoUrl } from "@/lib/github/repository";
import type { DeploySearchState } from "@/lib/deploy/query";
import { buildDeployRuntimeTargets } from "@/lib/deploy/runtime-targets";
import type { SessionUser } from "@/lib/auth/session";
import { getCurrentSession } from "@/lib/auth/session";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";
import type { WorkspaceAccess } from "@/lib/workspace/store";

export type DeployWorkspaceInventory = {
  projectInventoryError: string | null;
  projects: FugueProject[];
  runtimeTargetInventoryError: string | null;
  runtimeTargets: ConsoleImportRuntimeTargetView[];
  workspace: WorkspaceAccess | null;
  workspaceError: string | null;
};

export type DeployPageData = {
  inspection: FugueGitHubTemplateInspection | null;
  inspectionError: string | null;
  sessionPresent: boolean;
  workspaceInventory: DeployWorkspaceInventory;
};

function readErrorMessage(error: unknown) {
  if (!(error instanceof Error) || !error.message.trim()) {
    return "Request failed.";
  }

  return error.message
    .replace(/^Fugue request failed for [^:]+:\s*\d+\s+[A-Za-z ]+\.\s*/i, "")
    .trim();
}

async function loadInspection(
  search: DeploySearchState,
  session: SessionUser | null,
) {
  if (search.sourceMode !== "repository") {
    return {
      inspection: null,
      inspectionError: null,
    };
  }

  if (!search.repositoryUrl) {
    return {
      inspection: null,
      inspectionError: null,
    };
  }

  if (!isGitHubRepoUrl(search.repositoryUrl)) {
    return {
      inspection: null,
      inspectionError:
        "GitHub repository links must use https://github.com/owner/repo.",
    };
  }

  try {
    const repoAccess =
      search.repoVisibility === "private" && session
        ? await resolveGitHubRepoAuthTokenForEmail(session.email, {
            repoVisibility: search.repoVisibility,
          })
        : null;

    if (search.repoVisibility === "private" && !repoAccess?.token) {
      return {
        inspection: null,
        inspectionError: session
          ? PRIVATE_GITHUB_AUTH_REQUIRED_MESSAGE
          : "Sign in and authorize GitHub before inspecting private repositories.",
      };
    }

    return {
      inspection: await inspectGitHubTemplate(getFugueEnv().bootstrapKey, {
        branch: search.branch || undefined,
        repoAuthToken: repoAccess?.token || undefined,
        repoUrl: search.repositoryUrl,
        repoVisibility: search.repoVisibility,
      }),
      inspectionError: null,
    };
  } catch (error) {
    return {
      inspection: null,
      inspectionError: readErrorMessage(error),
    };
  }
}

async function loadWorkspaceInventory(
  session: SessionUser | null,
): Promise<DeployWorkspaceInventory> {
  if (!session) {
    return {
      projectInventoryError: null,
      projects: [],
      runtimeTargetInventoryError: null,
      runtimeTargets: [],
      workspace: null,
      workspaceError: null,
    };
  }

  try {
    const { workspace } = await ensureWorkspaceAccess(session);
    const [projectsResult, runtimesResult] = await Promise.allSettled([
      getFugueProjects(
        workspace.adminKeySecret,
        workspace.tenantId ?? undefined,
      ),
      getFugueRuntimes(workspace.adminKeySecret),
    ]);

    return {
      projectInventoryError:
        projectsResult.status === "rejected"
          ? readErrorMessage(projectsResult.reason)
          : null,
      projects:
        projectsResult.status === "fulfilled" ? projectsResult.value : [],
      runtimeTargetInventoryError:
        runtimesResult.status === "rejected"
          ? readErrorMessage(runtimesResult.reason)
          : null,
      runtimeTargets:
        runtimesResult.status === "fulfilled"
          ? buildDeployRuntimeTargets(runtimesResult.value, workspace.tenantId)
          : [],
      workspace,
      workspaceError: null,
    };
  } catch (error) {
    return {
      projectInventoryError: null,
      projects: [],
      runtimeTargetInventoryError: null,
      runtimeTargets: [],
      workspace: null,
      workspaceError: readErrorMessage(error),
    };
  }
}

export async function getDeployPageData(
  search: DeploySearchState,
): Promise<DeployPageData> {
  const session = await getCurrentSession();
  const [inspectionState, workspaceInventory] = await Promise.all([
    loadInspection(search, session),
    loadWorkspaceInventory(session),
  ]);

  return {
    inspection: inspectionState.inspection,
    inspectionError: inspectionState.inspectionError,
    sessionPresent: Boolean(session),
    workspaceInventory,
  };
}
