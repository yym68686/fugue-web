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
import { getRequestLocale } from "@/lib/i18n/server";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";
import {
  getWorkspaceAccessByEmail,
  type WorkspaceAccess,
} from "@/lib/workspace/store";

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

export type DeployPageShellData = Omit<DeployPageData, "workspaceInventory">;

function readErrorMessage(error: unknown) {
  if (!(error instanceof Error) || !error.message.trim()) {
    return "Request failed.";
  }

  return error.message
    .replace(/^Fugue request failed for [^:]+:\s*\d+\s+[A-Za-z ]+\.\s*/i, "")
    .trim();
}

function isUnauthorizedFugueError(error: unknown) {
  return error instanceof Error && error.message.includes("401");
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
  locale: Awaited<ReturnType<typeof getRequestLocale>>,
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
    let workspace = await getWorkspaceAccessByEmail(session.email);

    if (!workspace?.adminKeySecret) {
      const ensured = await ensureWorkspaceAccess(session);
      workspace = ensured.workspace;
    }

    const loadInventory = (activeWorkspace: WorkspaceAccess) =>
      Promise.allSettled([
      getFugueProjects(
          activeWorkspace.adminKeySecret,
          activeWorkspace.tenantId ?? undefined,
      ),
        getFugueRuntimes(activeWorkspace.adminKeySecret, {
          syncLocations: false,
        }),
      ]);

    let [projectsResult, runtimesResult] = await loadInventory(workspace);

    if (
      projectsResult.status === "rejected" &&
      runtimesResult.status === "rejected" &&
      isUnauthorizedFugueError(projectsResult.reason) &&
      isUnauthorizedFugueError(runtimesResult.reason)
    ) {
      const refreshed = await ensureWorkspaceAccess(session);
      workspace = refreshed.workspace;
      [projectsResult, runtimesResult] = await loadInventory(workspace);
    }

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
          ? buildDeployRuntimeTargets(
              runtimesResult.value,
              workspace.tenantId,
              locale,
            )
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

export async function getCurrentDeployWorkspaceInventory() {
  const session = await getCurrentSession();
  const locale = await getRequestLocale();

  return loadWorkspaceInventory(session, locale);
}

export async function getDeployPageShellData(
  search: DeploySearchState,
): Promise<DeployPageShellData> {
  const session = await getCurrentSession();
  const inspectionState = await loadInspection(search, session);

  return {
    inspection: inspectionState.inspection,
    inspectionError: inspectionState.inspectionError,
    sessionPresent: Boolean(session),
  };
}

export async function getDeployPageData(
  search: DeploySearchState,
): Promise<DeployPageData> {
  const session = await getCurrentSession();
  const locale = await getRequestLocale();
  const [inspectionState, workspaceInventory] = await Promise.all([
    loadInspection(search, session),
    loadWorkspaceInventory(session, locale),
  ]);

  return {
    inspection: inspectionState.inspection,
    inspectionError: inspectionState.inspectionError,
    sessionPresent: Boolean(session),
    workspaceInventory,
  };
}
