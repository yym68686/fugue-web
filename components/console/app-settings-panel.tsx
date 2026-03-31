"use client";

import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { StatusBadge } from "@/components/console/status-badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import type { ConsoleGalleryAppView } from "@/lib/console/gallery-types";
import type { ConsoleTone } from "@/lib/console/types";
import { isGitHubSourceType, isPrivateGitHubSourceType } from "@/lib/github/repository";

type ProjectPatchResponse = {
  project?: {
    id?: string;
    name?: string;
  } | null;
};

type RebuildResponse = {
  operation?: {
    id?: string | null;
  } | null;
};

type AppOperationResponse = {
  operation?: {
    id?: string | null;
  } | null;
};

type GitHubSyncState = {
  action: "disable" | "start" | null;
  actionLabel: string | null;
  description: string;
  label: string;
  tone: ConsoleTone;
};

type ProjectNameEntry = {
  id: string;
  name: string;
};

function normalizeText(value?: string | null) {
  return value?.trim() ?? "";
}

function slugifyLikeFugue(value: string) {
  const normalized = normalizeText(value).toLowerCase();
  let output = "";
  let lastDash = false;

  for (const char of normalized) {
    const isAlpha = char >= "a" && char <= "z";
    const isNumeric = char >= "0" && char <= "9";

    if (isAlpha || isNumeric) {
      output += char;
      lastDash = false;
      continue;
    }

    if (!lastDash && output.length > 0) {
      output += "-";
      lastDash = true;
    }
  }

  const trimmed = output.replace(/^-+/, "").replace(/-+$/, "");
  return trimmed || "item";
}

function isPausedApp(app: Pick<ConsoleGalleryAppView, "phase">) {
  const phase = normalizeText(app.phase).toLowerCase();
  return phase.includes("disabled") || phase.includes("paused");
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Request failed.";
}

async function readResponseError(response: Response) {
  const body = await response.text().catch(() => "");
  const trimmed = body.trim();

  if (!trimmed) {
    return `Request failed with status ${response.status}.`;
  }

  try {
    const payload = JSON.parse(trimmed) as { error?: unknown };

    if (typeof payload?.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    // Fall back to the raw response body when the payload is not JSON.
  }

  return trimmed;
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(await readResponseError(response));
  }

  return (await response.json().catch(() => null)) as T | null;
}

function readGitHubSyncState(app: ConsoleGalleryAppView): GitHubSyncState {
  if (!isGitHubSourceType(app.sourceType)) {
    return {
      action: null,
      actionLabel: null,
      description: "Automatic background sync is only available for services imported from GitHub repositories.",
      label: "Not available",
      tone: "neutral",
    };
  }

  if (app.serviceRole === "pending") {
    return {
      action: null,
      actionLabel: null,
      description: "The first import is still running. GitHub polling starts after the service reaches its first live replica.",
      label: "Pending import",
      tone: "info",
    };
  }

  if (isPausedApp(app)) {
    return {
      action: "start",
      actionLabel: "Turn on sync",
      description: "This app is paused at 0 replicas, so Fugue is not polling GitHub. Starting the app resumes background updates.",
      label: "Off",
      tone: "warning",
    };
  }

  return {
    action: "disable",
    actionLabel: "Turn off sync",
    description: "Fugue polls the tracked branch in the background and queues rebuilds when new commits arrive. Turning this off pauses the app at 0 replicas.",
    label: "On",
    tone: "positive",
  };
}

function readBranchFieldHint(app: ConsoleGalleryAppView) {
  if (!isGitHubSourceType(app.sourceType)) {
    return "Only GitHub-backed services keep a tracked source branch.";
  }

  if (app.serviceRole === "pending") {
    return "Wait for the first import to finish before changing the tracked branch.";
  }

  if (isPausedApp(app)) {
    return "Start the app before changing the tracked branch. Rebuilding from settings resumes replicas.";
  }

  return "Leave blank to follow the repository default branch. Saving queues a rebuild.";
}

function readRepositoryAccessHint(app: ConsoleGalleryAppView) {
  if (!isPrivateGitHubSourceType(app.sourceType)) {
    return "Only private GitHub repositories store an access token.";
  }

  if (app.serviceRole === "pending") {
    return "Wait for the first import to finish before rotating the saved token.";
  }

  if (isPausedApp(app)) {
    return "Start the app before rotating the saved token. Updating access queues a rebuild.";
  }

  return "Leave blank to keep the saved token. Updating access queues a rebuild.";
}

export function AppSettingsPanel({
  app,
  projectCatalog,
  projectId,
  projectManaged,
  projectName,
  serviceCount,
}: {
  app: ConsoleGalleryAppView;
  projectCatalog: ProjectNameEntry[];
  projectId: string;
  projectManaged: boolean;
  projectName: string;
  serviceCount: number;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [projectNameDraft, setProjectNameDraft] = useState(projectName);
  const [projectBaseline, setProjectBaseline] = useState(projectName);
  const [projectSaving, setProjectSaving] = useState(false);
  const [branchDraft, setBranchDraft] = useState(app.sourceBranchName ?? "");
  const [branchBaseline, setBranchBaseline] = useState(app.sourceBranchName ?? "");
  const [branchSaving, setBranchSaving] = useState(false);
  const [repoAuthTokenDraft, setRepoAuthTokenDraft] = useState("");
  const [repoAuthTokenSaving, setRepoAuthTokenSaving] = useState(false);
  const [syncSaving, setSyncSaving] = useState(false);

  useEffect(() => {
    setProjectBaseline(projectName);
    setProjectNameDraft(projectName);
  }, [projectId, projectName]);

  useEffect(() => {
    const nextBranch = app.sourceBranchName ?? "";
    setBranchBaseline(nextBranch);
    setBranchDraft(nextBranch);
  }, [app.id, app.sourceBranchName]);

  useEffect(() => {
    setRepoAuthTokenDraft("");
  }, [app.id]);

  const currentProjectName = normalizeText(projectBaseline);
  const currentBranch = branchBaseline;
  const normalizedProjectName = normalizeText(projectNameDraft);
  const normalizedBranch = normalizeText(branchDraft);
  const normalizedRepoAuthToken = normalizeText(repoAuthTokenDraft);
  const isGitHubSource = isGitHubSourceType(app.sourceType);
  const isPrivateGitHubSource = isPrivateGitHubSourceType(app.sourceType);
  const canEditBranch = isGitHubSource && app.serviceRole === "running" && !isPausedApp(app);
  const canUpdateRepoAccess =
    isPrivateGitHubSource && app.serviceRole === "running" && !isPausedApp(app);
  const syncState = readGitHubSyncState(app);
  const repoLabel = normalizeText(app.sourceLabel) || "Unlinked source";
  const branchChanged = normalizedBranch !== normalizeText(currentBranch);
  const repoAuthTokenChanged = normalizedRepoAuthToken.length > 0;
  const projectChanged = normalizedProjectName !== currentProjectName;
  const projectSlug = slugifyLikeFugue(normalizedProjectName);
  const conflictingProject = projectCatalog.find(
    (entry) => entry.id !== projectId && slugifyLikeFugue(entry.name) === projectSlug,
  );
  const projectNameError =
    projectManaged && projectChanged && !normalizedProjectName
      ? "Project name is required."
      : projectManaged && projectChanged && conflictingProject
        ? `Another project already uses “${conflictingProject.name}”.`
        : undefined;
  const canSaveProject =
    projectManaged && projectChanged && !projectSaving && !projectNameError;
  const settingsSummary = isPrivateGitHubSource
    ? `Rename the shared project shell, change the tracked branch, rotate saved GitHub access, or pause background sync for ${app.name}.`
    : `Rename the shared project shell, change which branch Fugue rebuilds from, or pause GitHub background sync for ${app.name}.`;
  const projectSectionNote = projectManaged
    ? `${serviceCount} service${serviceCount === 1 ? "" : "s"} share this project shell. Renaming it updates the whole group.`
    : "This service still lives in the Unassigned bucket, so the shared shell cannot be renamed yet.";
  const currentBranchLabel = normalizeText(currentBranch) || "Default branch";

  async function handleProjectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!projectManaged) {
      showToast({
        message: "Unassigned groups cannot be renamed yet.",
        variant: "info",
      });
      return;
    }

    if (!normalizedProjectName) {
      showToast({
        message: "Project name is required.",
        variant: "error",
      });
      return;
    }

    if (!projectChanged) {
      showToast({
        message: "No project name changes.",
        variant: "info",
      });
      return;
    }

    if (conflictingProject) {
      showToast({
        message: `Another project already uses “${conflictingProject.name}”. Project names must be unique within the workspace.`,
        variant: "error",
      });
      return;
    }

    setProjectSaving(true);

    try {
      await requestJson<ProjectPatchResponse>(`/api/fugue/projects/${projectId}`, {
        body: JSON.stringify({
          name: normalizedProjectName,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      setProjectBaseline(normalizedProjectName);
      setProjectNameDraft(normalizedProjectName);
      showToast({
        message: "Project name updated.",
        variant: "success",
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      const message = readErrorMessage(error);
      showToast({
        message:
          message.includes("resource conflict") || message.includes("409 Conflict")
            ? "Another project already uses this name. Project names must be unique within the workspace."
            : message,
        variant: "error",
      });
    } finally {
      setProjectSaving(false);
    }
  }

  async function handleBranchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isGitHubSource) {
      showToast({
        message: "Only GitHub-backed services can change the tracked branch.",
        variant: "info",
      });
      return;
    }

    if (!canEditBranch) {
      showToast({
        message: readBranchFieldHint(app),
        variant: "info",
      });
      return;
    }

    if (!branchChanged) {
      showToast({
        message: "No source branch changes.",
        variant: "info",
      });
      return;
    }

    setBranchSaving(true);

    try {
      await requestJson<RebuildResponse>(`/api/fugue/apps/${app.id}/rebuild`, {
        body: JSON.stringify({
          branch: normalizedBranch,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      setBranchBaseline(normalizedBranch);
      setBranchDraft(normalizedBranch);
      showToast({
        message: normalizedBranch
          ? `Rebuild queued from ${normalizedBranch}.`
          : "Rebuild queued from the repository default branch.",
        variant: "success",
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setBranchSaving(false);
    }
  }

  async function handleGitHubSyncToggle() {
    if (!syncState.action || syncSaving) {
      return;
    }

    setSyncSaving(true);

    try {
      await requestJson<AppOperationResponse>(
        syncState.action === "disable"
          ? `/api/fugue/apps/${app.id}/disable`
          : `/api/fugue/apps/${app.id}/start`,
        {
          method: "POST",
        },
      );

      showToast({
        message:
          syncState.action === "disable"
            ? "Pause queued. GitHub background sync will stop when replicas reach 0."
            : "Start queued. GitHub background sync will resume at 1 replica.",
        variant: "success",
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setSyncSaving(false);
    }
  }

  async function handleRepositoryAccessSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isPrivateGitHubSource) {
      showToast({
        message: "Only private GitHub-backed services store a repository token.",
        variant: "info",
      });
      return;
    }

    if (!canUpdateRepoAccess) {
      showToast({
        message: readRepositoryAccessHint(app),
        variant: "info",
      });
      return;
    }

    if (!normalizedRepoAuthToken) {
      showToast({
        message: "Paste a new GitHub token first.",
        variant: "info",
      });
      return;
    }

    setRepoAuthTokenSaving(true);

    try {
      await requestJson<RebuildResponse>(`/api/fugue/apps/${app.id}/rebuild`, {
        body: JSON.stringify({
          repoAuthToken: normalizedRepoAuthToken,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      setRepoAuthTokenDraft("");
      showToast({
        message: "Repository token updated. Rebuild queued.",
        variant: "success",
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setRepoAuthTokenSaving(false);
    }
  }

  return (
    <div className="fg-workbench-section fg-settings-panel">
      <div className="fg-workbench-section__copy fg-settings-panel__copy">
        <p className="fg-label fg-panel__eyebrow">Settings</p>
        <p className="fg-console-note">{settingsSummary}</p>
      </div>

      <section aria-label="Project shell" className="fg-route-subsection fg-settings-section">
        <div className="fg-route-subsection__head">
          <div className="fg-route-subsection__copy fg-settings-section__copy">
            <p className="fg-label fg-panel__eyebrow">Project</p>
            <h3 className="fg-route-subsection__title fg-ui-heading">Project shell</h3>
            <p className="fg-route-subsection__note">{projectSectionNote}</p>
          </div>

          <StatusBadge tone="neutral">
            {projectManaged ? `${serviceCount} services` : "Unassigned"}
          </StatusBadge>
        </div>

        {projectManaged ? (
          <form className="fg-settings-form" onSubmit={handleProjectSubmit}>
            <FormField
              error={projectNameError}
              hint="Must stay unique within this workspace."
              htmlFor={`project-name-${projectId}`}
              label="Project name"
            >
              <input
                autoComplete="off"
                className="fg-input"
                id={`project-name-${projectId}`}
                name="projectName"
                onChange={(event) => setProjectNameDraft(event.target.value)}
                placeholder="Project name"
                value={projectNameDraft}
              />
            </FormField>

            {projectChanged || projectSaving ? (
              <div className="fg-settings-form__actions">
                <Button
                  disabled={projectSaving}
                  onClick={() => setProjectNameDraft(projectBaseline)}
                  size="compact"
                  type="button"
                  variant="secondary"
                >
                  Reset
                </Button>
                <Button
                  disabled={!canSaveProject}
                  loading={projectSaving}
                  loadingLabel="Saving…"
                  size="compact"
                  type="submit"
                  variant="primary"
                >
                  Save name
                </Button>
              </div>
            ) : null}
          </form>
        ) : (
          <dl className="fg-settings-meta">
            <div>
              <dt>Current group</dt>
              <dd>{projectName}</dd>
            </div>
            <div>
              <dt>Save mode</dt>
              <dd>Unavailable</dd>
            </div>
          </dl>
        )}
      </section>

      <section aria-label="Tracked branch" className="fg-route-subsection fg-settings-section">
        <div className="fg-route-subsection__head">
          <div className="fg-route-subsection__copy fg-settings-section__copy">
            <p className="fg-label fg-panel__eyebrow">Source</p>
            <h3 className="fg-route-subsection__title fg-ui-heading">Tracked branch</h3>
            <p className="fg-route-subsection__note">{readBranchFieldHint(app)}</p>
          </div>

          <StatusBadge tone={isGitHubSource ? "info" : "neutral"}>
            {isGitHubSource ? "GitHub" : "Fixed source"}
          </StatusBadge>
        </div>

        <form className="fg-settings-form" onSubmit={handleBranchSubmit}>
          <FormField
            htmlFor={`service-branch-${app.id}`}
            label="Tracked branch"
            optionalLabel="Optional"
          >
            <input
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              className="fg-input"
              disabled={!canEditBranch || branchSaving}
              id={`service-branch-${app.id}`}
              name="trackedBranch"
              onChange={(event) => setBranchDraft(event.target.value)}
              placeholder="main"
              spellCheck={false}
              value={branchDraft}
            />
          </FormField>

          <dl className="fg-settings-meta">
            <div>
              <dt>Repository</dt>
              <dd>
                {app.sourceHref ? (
                  <a
                    className="fg-text-link"
                    href={app.sourceHref}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {repoLabel}
                  </a>
                ) : (
                  repoLabel
                )}
              </dd>
            </div>
            <div>
              <dt>Saved branch</dt>
              <dd>{currentBranchLabel}</dd>
            </div>
            <div>
              <dt>Build source</dt>
              <dd>{normalizeText(app.sourceMeta) || "Unknown"}</dd>
            </div>
            <div>
              <dt>Service state</dt>
              <dd>{app.phase}</dd>
            </div>
          </dl>

          {branchChanged || branchSaving ? (
            <div className="fg-settings-form__actions">
              <Button
                disabled={branchSaving}
                onClick={() => setBranchDraft(currentBranch)}
                size="compact"
                type="button"
                variant="secondary"
              >
                Reset
              </Button>
              <Button
                disabled={!canEditBranch || !branchChanged || branchSaving}
                loading={branchSaving}
                loadingLabel="Queueing…"
                size="compact"
                type="submit"
                variant="primary"
              >
                Save and rebuild
              </Button>
            </div>
          ) : null}
        </form>
      </section>

      {isPrivateGitHubSource ? (
        <section
          aria-label="Repository access"
          className="fg-route-subsection fg-settings-section"
        >
          <div className="fg-route-subsection__head">
            <div className="fg-route-subsection__copy fg-settings-section__copy">
              <p className="fg-label fg-panel__eyebrow">Source</p>
              <h3 className="fg-route-subsection__title fg-ui-heading">Private repository access</h3>
              <p className="fg-route-subsection__note">{readRepositoryAccessHint(app)}</p>
            </div>

            <StatusBadge tone="info">Stored token</StatusBadge>
          </div>

          <form className="fg-settings-form" onSubmit={handleRepositoryAccessSubmit}>
            <FormField
              hint="Use a GitHub token with repository read access. Fugue stores it server-side for later rebuilds and syncs."
              htmlFor={`repo-auth-token-${app.id}`}
              label="Replace token"
              optionalLabel="Optional"
            >
              <input
                autoCapitalize="none"
                autoComplete="new-password"
                className="fg-input"
                disabled={!canUpdateRepoAccess || repoAuthTokenSaving}
                id={`repo-auth-token-${app.id}`}
                name="repoAuthToken"
                onChange={(event) => setRepoAuthTokenDraft(event.target.value)}
                placeholder="github_pat_..."
                spellCheck={false}
                type="password"
                value={repoAuthTokenDraft}
              />
            </FormField>

            <dl className="fg-settings-meta">
              <div>
                <dt>Repository</dt>
                <dd>
                  {app.sourceHref ? (
                    <a
                      className="fg-text-link"
                      href={app.sourceHref}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {repoLabel}
                    </a>
                  ) : (
                    repoLabel
                  )}
                </dd>
              </div>
              <div>
                <dt>Access mode</dt>
                <dd>Private repository</dd>
              </div>
              <div>
                <dt>Stored credential</dt>
                <dd>Server-side token</dd>
              </div>
              <div>
                <dt>Save behavior</dt>
                <dd>Queues a rebuild</dd>
              </div>
            </dl>

            {repoAuthTokenChanged || repoAuthTokenSaving ? (
              <div className="fg-settings-form__actions">
                <Button
                  disabled={repoAuthTokenSaving}
                  onClick={() => setRepoAuthTokenDraft("")}
                  size="compact"
                  type="button"
                  variant="secondary"
                >
                  Reset
                </Button>
                <Button
                  disabled={!canUpdateRepoAccess || !repoAuthTokenChanged || repoAuthTokenSaving}
                  loading={repoAuthTokenSaving}
                  loadingLabel="Queueing…"
                  size="compact"
                  type="submit"
                  variant="primary"
                >
                  Update token and rebuild
                </Button>
              </div>
            ) : null}
          </form>
        </section>
      ) : null}

      <section aria-label="GitHub sync" className="fg-route-subsection fg-settings-section">
        <div className="fg-route-subsection__head">
          <div className="fg-route-subsection__copy fg-settings-section__copy">
            <p className="fg-label fg-panel__eyebrow">Sync</p>
            <h3 className="fg-route-subsection__title fg-ui-heading">GitHub auto sync</h3>
            <p className="fg-route-subsection__note">{syncState.description}</p>
          </div>

          <div className="fg-settings-sync__summary">
            <StatusBadge live={syncState.action === "disable"} tone={syncState.tone}>
              {syncState.label}
            </StatusBadge>

            {syncState.actionLabel ? (
              <Button
                loading={syncSaving}
                loadingLabel={syncState.action === "disable" ? "Pausing…" : "Starting…"}
                onClick={handleGitHubSyncToggle}
                size="compact"
                type="button"
                variant={syncState.action === "disable" ? "secondary" : "primary"}
              >
                {syncState.actionLabel}
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
