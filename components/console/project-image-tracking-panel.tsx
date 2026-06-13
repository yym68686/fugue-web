"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { useI18n } from "@/components/providers/i18n-provider";
import { StatusBadge } from "@/components/console/status-badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { HintInline } from "@/components/ui/hint-tooltip";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useToast } from "@/components/ui/toast";
import { useGitHubConnection } from "@/lib/github/connection-client";
import type { ConsoleTone } from "@/lib/console/types";

type ProjectImageTrackingBinding = {
  enabled: boolean;
  fugueProjectId: string;
  githubRepo?: string;
  githubInstallationId: string | null;
  id: string;
  updatedAt: string;
  userEmail: string;
};

type ProjectImageTrackingGitHubAppStatus = {
  accountLogin: string | null;
  checkedAt?: string | null;
  githubInstallationId?: string | null;
  githubRepo: string;
  installed: boolean;
  installationId?: string | null;
  installationSource?:
    | "binding"
    | "cached"
    | "connection-missing"
    | "error"
    | "live"
    | "missing"
    | "none"
    | "public-repo";
  lastEventName?: string | null;
  lastEventReceivedAt?: string | null;
  lastImageSyncAt?: string | null;
  lastImageSyncError?: string | null;
  repositorySelection: string | null;
  source?:
    | "cached"
    | "connection-missing"
    | "error"
    | "live"
    | "missing"
    | "public-repo";
  verified: boolean;
  webhookActive?: boolean;
};

type ProjectImageTrackingStrategyScope = "none" | "project" | "service";

type ProjectImageTrackingTrigger = "none" | "polling" | "webhook";

type ProjectDefaultSaveMode = "preserve-overrides" | "apply-to-matching";

type ProjectImageTrackingServiceTracking = {
  enabled: boolean;
  githubRepo: string | null;
  imageRef: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  lastTriggeredAt: string | null;
  scope: ProjectImageTrackingStrategyScope;
  trigger: ProjectImageTrackingTrigger;
  updatedAt: string | null;
};

type ProjectImageTrackingService = {
  appId: string;
  appName: string;
  enabled: boolean;
  githubRepo: string | null;
  imageRef: string | null;
  linked: boolean;
  matchReason: string | null;
  source: {
    buildContextDir: string | null;
    composeService: string | null;
    detectedStack: string | null;
    dockerfilePath: string | null;
    imageNameSuffix: string | null;
  };
  tracking: ProjectImageTrackingServiceTracking;
  updatedAt: string | null;
};

type ProjectImageTrackingServiceSummary = {
  projectLinkedCount: number;
  serviceOverrideCount: number;
  totalCount: number;
  trackedCount: number;
};

type ProjectImageTrackingResponse = {
  binding: ProjectImageTrackingBinding | null;
  githubApp: ProjectImageTrackingGitHubAppStatus;
  linkedCount: number;
  projectId: string;
  services: ProjectImageTrackingService[];
  serviceSummary: ProjectImageTrackingServiceSummary;
};

type ProjectImageTrackingInstallResponse = {
  githubApp: ProjectImageTrackingGitHubAppStatus;
};

export interface ProjectImageTrackingPanelProps {
  disabled?: boolean;
  onLinked?: () => void;
  projectId: string;
  projectName: string;
}

type LoadState = "error" | "idle" | "loading" | "ready";

type GitHubImageStatusRow = {
  detail: string;
  key: string;
  label: string;
  live?: boolean;
  tone?: ConsoleTone;
  value: string;
};

interface RequestError extends Error {
  payload?: unknown;
  status: number;
}

function isRequestError(error: unknown): error is RequestError {
  return error !== null && typeof error === "object" && "status" in error;
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);
  const bodyText = await response.text().catch(() => "");

  if (!response.ok) {
    let payload: unknown = null;
    let message = `Request failed with status ${response.status}.`;

    if (bodyText.trim()) {
      try {
        payload = JSON.parse(bodyText) as unknown;
        const payloadError =
          payload && typeof payload === "object" && "error" in payload
            ? (payload as { error?: unknown }).error
            : null;

        if (typeof payloadError === "string" && payloadError.trim()) {
          message = payloadError.trim();
        }
      } catch {
        message = bodyText.trim();
      }
    }

    const error = new Error(message) as RequestError;
    error.payload = payload;
    error.status = response.status;
    throw error;
  }

  return (bodyText.trim() ? (JSON.parse(bodyText) as T) : ({} as T));
}

function normalizeGitHubRepoInput(value: string) {
  let normalized = value.trim();

  if (!normalized) {
    return "";
  }

  const sshMatch = /^git@github\.com:([^/\s]+)\/([^/\s]+)$/i.exec(normalized);

  if (sshMatch) {
    normalized = `${sshMatch[1]}/${sshMatch[2]}`;
  } else {
    const urlMatch =
      /^https?:\/\/(?:www\.)?github\.com\/([^/\s]+)\/([^/\s?#]+)(?:[/?#].*)?$/i.exec(
        normalized,
      );

    if (urlMatch) {
      normalized = `${urlMatch[1]}/${urlMatch[2]}`;
    }
  }

  return normalized.replace(/\.git$/i, "").toLowerCase();
}

function readGitHubRepoError(value: string) {
  const normalized = normalizeGitHubRepoInput(value);

  if (!normalized) {
    return "GitHub repository is required.";
  }

  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(normalized)) {
    return "Use owner/repo or a GitHub repository URL.";
  }

  return null;
}

function readServiceMeta(service: ProjectImageTrackingService) {
  return [
    service.source.composeService
      ? `compose:${service.source.composeService}`
      : null,
    service.source.dockerfilePath,
    service.source.buildContextDir
      ? `context:${service.source.buildContextDir}`
      : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" / ");
}

function readServiceScope(service: ProjectImageTrackingService) {
  return (
    service.tracking?.scope ??
    (service.linked ? "project" : service.enabled ? "service" : "none")
  );
}

function readStrategyLabel(scope: ProjectImageTrackingStrategyScope) {
  if (scope === "project") {
    return "Project default";
  }

  if (scope === "service") {
    return "Service override";
  }

  return "Off";
}

function readTriggerLabel(trigger: ProjectImageTrackingTrigger) {
  if (trigger === "webhook") {
    return "Webhook events";
  }

  if (trigger === "polling") {
    return "Registry polling";
  }

  return "No update signal";
}

function readStrategyDetail(service: ProjectImageTrackingService) {
  const scope = readServiceScope(service);

  if (scope === "project") {
    return service.tracking.trigger === "webhook"
      ? "Following the project default from webhook events."
      : "Following the project default by registry polling.";
  }

  if (scope === "service") {
    return service.tracking.trigger === "webhook"
      ? "This service keeps its own webhook tracking."
      : "This service keeps its own registry polling.";
  }

  return "This service does not update images automatically.";
}

function readStrategyTone(scope: ProjectImageTrackingStrategyScope): ConsoleTone {
  if (scope === "project") {
    return "positive";
  }

  if (scope === "service") {
    return "info";
  }

  return "neutral";
}

function buildInstallReturnTo(returnTo: string, githubRepo: string) {
  const url = new URL(returnTo, "https://fugue.local");
  url.searchParams.set("githubImageRepo", githubRepo);
  url.searchParams.set("githubImageFlow", "1");
  return `${url.pathname}${url.search}`;
}

function clearImageFlowSearchParams() {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.delete("githubImageFlow");
  url.searchParams.delete("githubApp");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export function ProjectImageTrackingPanel({
  disabled = false,
  onLinked,
  projectId,
  projectName,
}: ProjectImageTrackingPanelProps) {
  const { formatDateTime, t } = useI18n();
  const { showToast } = useToast();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();
  const githubImageFlowActive = searchParams.get("githubImageFlow") === "1";
  const githubAppCallbackState = searchParams.get("githubApp");
  const autoFlowRef = useRef<string | null>(null);
  const [response, setResponse] = useState<ProjectImageTrackingResponse | null>(
    null,
  );
  const [repoInstallation, setRepoInstallation] =
    useState<ProjectImageTrackingGitHubAppStatus | null>(null);
  const [repoInstallationRepo, setRepoInstallationRepo] = useState("");
  const [repoInstallationError, setRepoInstallationError] = useState<
    string | null
  >(null);
  const [repoInstallationLoading, setRepoInstallationLoading] = useState(false);
  const [status, setStatus] = useState<LoadState>("idle");
  const [repoDraft, setRepoDraft] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingMode, setSavingMode] = useState<ProjectDefaultSaveMode | null>(
    null,
  );
  const repoError = readGitHubRepoError(repoDraft);
  const repoFieldError =
    (submitAttempted || repoDraft) && repoError ? t(repoError) : undefined;
  const normalizedRepo = normalizeGitHubRepoInput(repoDraft);
  const currentReturnTo = currentSearch
    ? `${pathname}?${currentSearch}`
    : pathname;
  const githubFlowReturnTo =
    normalizedRepo && !repoError
      ? buildInstallReturnTo(currentReturnTo, normalizedRepo)
      : currentReturnTo;
  const {
    connectHref: githubConnectHref,
    connection: githubConnection,
    error: githubConnectionError,
    loading: githubConnectionLoading,
  } = useGitHubConnection({
    enabled: true,
    returnTo: githubFlowReturnTo,
  });
  const boundRepo = response?.binding?.githubRepo ?? "";
  const normalizedBoundRepo = normalizeGitHubRepoInput(boundRepo);
  const hasRepoCandidate = Boolean(normalizedRepo && !repoError);
  const currentGitHubAppStatus = hasRepoCandidate
    ? normalizedRepo === boundRepo
      ? response?.githubApp ?? repoInstallation
      : repoInstallationRepo === normalizedRepo
        ? repoInstallation
        : null
    : boundRepo
      ? response?.githubApp ?? null
      : null;
  const installHref =
    normalizedRepo && !repoError
      ? `/api/github/app/install/start?githubRepo=${encodeURIComponent(
          normalizedRepo,
        )}&returnTo=${encodeURIComponent(
          buildInstallReturnTo(currentReturnTo, normalizedRepo),
        )}`
      : null;
  const appInstalled = Boolean(currentGitHubAppStatus?.installed);
  const publicRepoReady = currentGitHubAppStatus?.source === "public-repo";
  const repoReadyForProjectDefault = Boolean(appInstalled || publicRepoReady);
  const githubOAuthEnabled = Boolean(githubConnection?.authEnabled);
  const githubAccountConnected = Boolean(githubConnection?.connected);
  const shouldConnectGitHubFirst = Boolean(
    hasRepoCandidate &&
      githubOAuthEnabled &&
      !githubAccountConnected,
  );
  const installationCheckPending = Boolean(
    hasRepoCandidate && !currentGitHubAppStatus && !repoInstallationError,
  );
  const serviceSummary = response?.serviceSummary ?? {
    projectLinkedCount:
      response?.services.filter((service) => readServiceScope(service) === "project")
        .length ?? 0,
    serviceOverrideCount:
      response?.services.filter((service) => readServiceScope(service) === "service")
        .length ?? 0,
    totalCount: response?.services.length ?? 0,
    trackedCount:
      response?.services.filter((service) => readServiceScope(service) !== "none")
        .length ?? 0,
  };
  const projectDefaultConfigured = Boolean(response?.binding?.enabled && boundRepo);
  const draftIsProjectDefault = Boolean(
    projectDefaultConfigured && normalizedRepo && normalizedRepo === normalizedBoundRepo,
  );
  const hasServiceOverrides = serviceSummary.serviceOverrideCount > 0;
  const serviceOverrideCountLabel = t(
    serviceSummary.serviceOverrideCount === 1
      ? "{count} service"
      : "{count} services",
    { count: serviceSummary.serviceOverrideCount },
  );
  const draftChanged = Boolean(
    normalizedRepo && normalizedRepo !== normalizedBoundRepo,
  );
  const canSaveProjectDefault = Boolean(
    hasRepoCandidate &&
      repoReadyForProjectDefault &&
      normalizedRepo &&
      (!projectDefaultConfigured || draftChanged),
  );
  const canApplyProjectDefault = Boolean(
    hasRepoCandidate &&
      repoReadyForProjectDefault &&
      projectDefaultConfigured &&
      draftIsProjectDefault &&
      hasServiceOverrides,
  );
  const installationId =
    currentGitHubAppStatus?.installationId ??
    currentGitHubAppStatus?.githubInstallationId ??
    null;
  const webhookActive = Boolean(
    currentGitHubAppStatus?.webhookActive ??
      currentGitHubAppStatus?.lastEventReceivedAt,
  );
  const canSubmit =
    !disabled &&
    !saving &&
    status !== "loading" &&
    canSaveProjectDefault &&
    !repoError &&
    repoReadyForProjectDefault;
  const repositoryAction =
    !hasRepoCandidate || repoError
      ? "none"
      : status === "loading" ||
          repoInstallationLoading ||
          githubConnectionLoading ||
          installationCheckPending
        ? "wait"
        : shouldConnectGitHubFirst
          ? "connect-github"
          : repoReadyForProjectDefault
            ? "bind"
            : installHref
              ? "install-app"
              : "none";
  const primaryActionDisabled = Boolean(
    disabled ||
      saving ||
      repositoryAction === "none" ||
      repositoryAction === "wait" ||
      (repositoryAction === "connect-github" && !githubConnectHref) ||
      (repositoryAction === "bind" && !canSubmit),
  );
  const primaryActionLabel =
    repositoryAction === "connect-github"
      ? t("Connect GitHub repository")
      : repositoryAction === "install-app"
        ? t("Authorize repository")
        : projectDefaultConfigured
          ? draftChanged
            ? t("Update project default")
            : t("Project default saved")
          : response?.binding
          ? t("Save project default")
          : t("Save project default");
  const primaryActionLoadingLabel =
    repositoryAction === "wait"
      ? t("Checking GitHub access…")
      : savingMode === "apply-to-matching"
        ? t("Applying to matching services…")
        : t("Saving project default…");
  const statusLabel =
    status === "error"
      ? t("Unavailable")
      : status === "loading"
        ? t("Loading")
        : repoInstallationLoading
          ? t("Checking…")
          : projectDefaultConfigured
            ? t("Project default saved")
            : hasServiceOverrides
              ? t("Service overrides active")
              : appInstalled || publicRepoReady
                ? t("Repository ready")
                : hasRepoCandidate
                  ? t("Access required")
                  : t("Not configured");
  const statusTone =
    status === "error"
      ? ("warning" as const)
      : projectDefaultConfigured
        ? ("positive" as const)
      : hasServiceOverrides || appInstalled
        ? ("info" as const)
        : publicRepoReady
          ? ("info" as const)
          : ("neutral" as const);

  useEffect(() => {
    let cancelled = false;

    setStatus("loading");
    setSubmitAttempted(false);

    requestJson<ProjectImageTrackingResponse>(
      `/api/fugue/projects/${projectId}/image-tracking`,
    )
      .then((nextResponse) => {
        if (cancelled) {
          return;
        }

        setResponse(nextResponse);
        const query = new URLSearchParams(currentSearch);
        const queryRepo = normalizeGitHubRepoInput(query.get("githubImageRepo") ?? "");
        setRepoDraft(nextResponse.binding?.githubRepo ?? queryRepo);
        setStatus("ready");
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setStatus("error");
        showToast({
          message: error instanceof Error ? error.message : t("Request failed."),
          variant: "error",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [currentSearch, projectId, showToast, t]);

  useEffect(() => {
    const repo = normalizedRepo;

    if (!repo || repoError) {
      setRepoInstallationError(null);
      setRepoInstallationLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setRepoInstallationLoading(true);
      setRepoInstallationError(null);

      requestJson<ProjectImageTrackingInstallResponse>(
        `/api/github/app/installations?githubRepo=${encodeURIComponent(repo)}`,
        {
          signal: controller.signal,
        },
      )
        .then((nextResponse) => {
          if (cancelled) {
            return;
          }

          setRepoInstallation(nextResponse.githubApp);
          setRepoInstallationRepo(repo);
          setRepoInstallationLoading(false);
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }

          const message =
            error instanceof Error && error.message.trim()
              ? error.message
              : t("Request failed.");

          setRepoInstallation(null);
          setRepoInstallationRepo(repo);
          setRepoInstallationError(message);
          setRepoInstallationLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [normalizedRepo, repoError, t]);

  const saveProjectDefault = useCallback(async (preserveServiceOverrides: boolean) => {
    setSubmitAttempted(true);

    const canRun = preserveServiceOverrides ? canSubmit : canApplyProjectDefault;

    if (!canRun || saving || status === "loading") {
      return false;
    }

    setSaving(true);
    setSavingMode(preserveServiceOverrides ? "preserve-overrides" : "apply-to-matching");

    try {
      const nextResponse = await requestJson<ProjectImageTrackingResponse>(
        `/api/fugue/projects/${projectId}/image-tracking`,
        {
          body: JSON.stringify({
            githubRepo: normalizedRepo,
            preserveServiceOverrides,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PUT",
        },
      );

      setResponse(nextResponse);
      setRepoDraft(nextResponse.binding?.githubRepo ?? normalizedRepo);
      setRepoInstallation(nextResponse.githubApp);
      setRepoInstallationRepo(nextResponse.binding?.githubRepo ?? normalizedRepo);
      setRepoInstallationError(null);
      setSubmitAttempted(false);
      setStatus("ready");
      const linkedCountLabel = t(
        nextResponse.linkedCount === 1 ? "{count} service" : "{count} services",
        { count: nextResponse.linkedCount },
      );
      showToast({
        message: preserveServiceOverrides
          ? t("Project default source saved for {countLabel}.", {
              countLabel: linkedCountLabel,
            })
          : t("Project default source applied to {countLabel}.", {
              countLabel: linkedCountLabel,
            }),
        variant: "success",
      });
      onLinked?.();
      return true;
    } catch (error) {
      if (
        isRequestError(error) &&
        error.payload &&
        typeof error.payload === "object" &&
        "githubApp" in error.payload
      ) {
        const githubApp = (error.payload as {
          githubApp?: ProjectImageTrackingGitHubAppStatus;
        }).githubApp;

        if (githubApp) {
          setRepoInstallation(githubApp);
          setRepoInstallationRepo(githubApp.githubRepo || normalizedRepo);
        }
      }

      showToast({
        message: error instanceof Error ? error.message : t("Request failed."),
        variant: "error",
      });
      return false;
    } finally {
      setSavingMode(null);
      setSaving(false);
    }
  }, [canApplyProjectDefault, canSubmit, normalizedRepo, onLinked, projectId, saving, showToast, status, t]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await handlePrimaryAction();
  }

  async function handlePrimaryAction() {
    setSubmitAttempted(true);

    if (primaryActionDisabled) {
      return;
    }

    if (repositoryAction === "connect-github") {
      window.location.assign(githubConnectHref);
      return;
    }

    if (
      repositoryAction === "install-app" &&
      installHref &&
      githubAppCallbackState !== "github-app-install-failed"
    ) {
      window.location.assign(installHref);
      return;
    }

    if (repositoryAction === "bind") {
      const saved = await saveProjectDefault(true);

      if (saved && githubImageFlowActive) {
        clearImageFlowSearchParams();
      }
    }
  }

  const applyProjectDefaultToMatchingServices = useCallback(async () => {
    if (!canApplyProjectDefault || saving || status !== "ready") {
      return;
    }

    const saved = await saveProjectDefault(false);

    if (saved && githubImageFlowActive) {
      clearImageFlowSearchParams();
    }
  }, [canApplyProjectDefault, githubImageFlowActive, saveProjectDefault, saving, status]);

  useEffect(() => {
    if (!githubImageFlowActive || !hasRepoCandidate || repoError) {
      return;
    }

    if (
      status !== "ready" ||
      repoInstallationLoading ||
      githubConnectionLoading ||
      saving
    ) {
      return;
    }

    const flowKey = `${repositoryAction}:${normalizedRepo}:${githubConnection?.connected ? "connected" : "anonymous"}:${currentGitHubAppStatus?.installed ? "installed" : currentGitHubAppStatus?.source ?? "unknown"}`;

    if (autoFlowRef.current === flowKey) {
      return;
    }

    autoFlowRef.current = flowKey;

    if (repositoryAction === "connect-github") {
      window.location.assign(githubConnectHref);
      return;
    }

    if (repositoryAction === "install-app" && installHref) {
      window.location.assign(installHref);
      return;
    }

    if (repositoryAction === "bind" && canSaveProjectDefault) {
      void saveProjectDefault(true).then((saved) => {
        if (saved) {
          clearImageFlowSearchParams();
        }
      });
    }
  }, [
    canSaveProjectDefault,
    currentGitHubAppStatus?.installed,
    currentGitHubAppStatus?.source,
    githubConnectHref,
    githubConnection?.connected,
    githubConnectionLoading,
    githubImageFlowActive,
    installationCheckPending,
    hasRepoCandidate,
    installHref,
    normalizedRepo,
    repoError,
    repoInstallationLoading,
    repositoryAction,
    saveProjectDefault,
    saving,
    status,
  ]);

  const githubStatusRows: GitHubImageStatusRow[] = [];

  function readServiceActivity(service: ProjectImageTrackingService) {
    if (service.tracking.lastError) {
      return {
        detail: service.tracking.lastError,
        tone: "warning" as const,
        value: t("Sync error"),
      };
    }

    if (service.tracking.lastTriggeredAt) {
      return {
        detail:
          service.tracking.trigger === "webhook"
            ? t("Webhook event")
            : t("Last triggered"),
        value: formatDateTime(service.tracking.lastTriggeredAt),
      };
    }

    if (service.tracking.lastCheckedAt) {
      return {
        detail: t("Last checked"),
        value: formatDateTime(service.tracking.lastCheckedAt),
      };
    }

    if (service.tracking.updatedAt) {
      return {
        detail: t("Updated"),
        value: formatDateTime(service.tracking.updatedAt),
      };
    }

    return {
      detail: t("No activity yet"),
      value: "—",
    };
  }

  if (currentGitHubAppStatus && hasRepoCandidate) {
    githubStatusRows.push(
      {
        detail: githubAccountConnected
          ? githubConnection?.login
            ? t("Signed in as @{login}.", {
                login: githubConnection.login,
              })
            : t("GitHub connection is ready.")
          : githubOAuthEnabled
            ? t("Fugue will connect GitHub first, then continue repository authorization.")
            : t("GitHub connection is not configured. Public repositories can still use polling."),
        key: "github-connection",
        label: t("GitHub account"),
        live: githubAccountConnected,
        tone: githubAccountConnected
          ? "positive"
          : githubOAuthEnabled
            ? "info"
            : "neutral",
        value: githubAccountConnected
          ? t("Connected")
          : githubOAuthEnabled
            ? t("Ready to connect")
            : t("Not configured"),
      },
      {
        detail: currentGitHubAppStatus.installed
          ? currentGitHubAppStatus.accountLogin
            ? t("Authorized as @{login}.", {
                login: currentGitHubAppStatus.accountLogin,
              })
            : currentGitHubAppStatus.checkedAt
              ? t("Checked {value}", {
                  value: formatDateTime(currentGitHubAppStatus.checkedAt),
                })
              : installationId
                ? t("Installation #{id}", {
                    id: installationId,
                  })
                : t("Installed")
          : publicRepoReady
            ? t(
                "Public repositories can use automatic polling without installing the GitHub App.",
              )
            : t(
                "Fugue will open GitHub only if this repository still needs App access.",
              ),
        key: "repository-access",
        label: t("Repository access"),
        live: currentGitHubAppStatus.installed,
        tone: currentGitHubAppStatus.installed
          ? "positive"
          : publicRepoReady
            ? "info"
            : "neutral",
        value: currentGitHubAppStatus.installed
          ? t("Authorized")
          : publicRepoReady
            ? t("Public repository")
            : t("Needs authorization"),
      },
      {
        detail: draftIsProjectDefault
          ? hasServiceOverrides
            ? t(
                "Existing service-level tracking stays unchanged unless a service is changed later.",
              )
            : t("Services without their own strategy follow this project default.")
          : repoReadyForProjectDefault
            ? t("Set this repository as the project default source.")
            : t("Set a project default after repository access is available."),
        key: "project-default",
        label: t("Project default"),
        live: draftIsProjectDefault,
        tone: draftIsProjectDefault
          ? "positive"
          : repoReadyForProjectDefault
            ? "info"
            : "neutral",
        value: draftIsProjectDefault
          ? t("Enabled")
          : repoReadyForProjectDefault
            ? t("Ready to set")
            : t("Not configured"),
      },
      {
        detail: webhookActive
          ? currentGitHubAppStatus.lastEventName
            ? t("Last event: {name}", {
                name: currentGitHubAppStatus.lastEventName,
              })
            : currentGitHubAppStatus.lastEventReceivedAt
              ? formatDateTime(currentGitHubAppStatus.lastEventReceivedAt)
              : t("Active")
          : currentGitHubAppStatus.installed
            ? t("No events yet")
            : publicRepoReady
              ? t("Polling is available. Webhook events require GitHub App access.")
              : t("Available after repository authorization."),
        key: "webhook",
        label: t("Update signal"),
        live: webhookActive,
        tone: webhookActive ? "positive" : "neutral",
        value: webhookActive
          ? t("Webhook active")
          : currentGitHubAppStatus.installed
            ? t("Waiting for events")
            : t("Polling fallback"),
      },
    );

    if (hasServiceOverrides) {
      githubStatusRows.push({
        detail: t("These services keep their existing service-level tracking."),
        key: "service-overrides",
        label: t("Service overrides"),
        live: true,
        tone: "info",
        value: serviceOverrideCountLabel,
      });
    }

    if (
      projectDefaultConfigured ||
      currentGitHubAppStatus.lastImageSyncAt ||
      currentGitHubAppStatus.lastImageSyncError
    ) {
      githubStatusRows.push({
        detail: currentGitHubAppStatus.lastImageSyncError
          ? currentGitHubAppStatus.lastImageSyncError
          : currentGitHubAppStatus.lastImageSyncAt
            ? t("Ready")
            : t("No sync has run yet."),
        key: "last-sync",
        label: t("Last image sync"),
        value: currentGitHubAppStatus.lastImageSyncAt
          ? formatDateTime(currentGitHubAppStatus.lastImageSyncAt)
          : t("Not yet"),
      });
    }
  }

  return (
    <section
      aria-label={t("GitHub image updates")}
      className="fg-route-subsection fg-settings-section fg-project-image-sync"
    >
      <div className="fg-route-subsection__head">
        <div className="fg-route-subsection__copy fg-settings-section__copy">
          <p className="fg-label fg-panel__eyebrow">{t("Image updates")}</p>
          <HintInline
            ariaLabel={t("Automatic image updates")}
            hint={t(
              "Set a project default repository for automatic image updates. Services can follow the default or keep their own strategy.",
            )}
          >
            <h3 className="fg-route-subsection__title fg-ui-heading">
              {t("Automatic image updates")}
            </h3>
          </HintInline>
        </div>

        <StatusBadge
          live={projectDefaultConfigured || serviceSummary.trackedCount > 0}
          tone={statusTone}
        >
          {statusLabel}
        </StatusBadge>
      </div>

      {status === "error" ? (
        <InlineAlert variant="error">
          {t("Unable to load GitHub image update settings right now.")}
        </InlineAlert>
      ) : null}

      <form className="fg-project-image-sync__form" onSubmit={handleSubmit}>
        <FormField
          error={repoFieldError}
          htmlFor={`project-image-repo-${projectId}`}
          label={t("Project default repository")}
        >
          <input
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            aria-invalid={repoFieldError ? "true" : undefined}
            className="fg-input"
            disabled={disabled || saving}
            id={`project-image-repo-${projectId}`}
            name="githubRepo"
            onBlur={() => {
              const normalized = normalizeGitHubRepoInput(repoDraft);

              if (normalized) {
                setRepoDraft(normalized);
              }
            }}
            onChange={(event) => {
              setRepoDraft(event.target.value);
            }}
            placeholder="yym68686/uni-api…"
            spellCheck={false}
            value={repoDraft}
          />
        </FormField>

        <div className="fg-settings-form__actions fg-project-image-sync__actions">
          <Button
            disabled={primaryActionDisabled}
            loading={
              (saving && savingMode === "preserve-overrides") ||
              repositoryAction === "wait"
            }
            loadingLabel={primaryActionLoadingLabel}
            onClick={handlePrimaryAction}
            size="compact"
            type="button"
            variant="primary"
          >
            {primaryActionLabel}
          </Button>
          {canApplyProjectDefault ? (
            <Button
              disabled={disabled || saving || status !== "ready"}
              loading={savingMode === "apply-to-matching"}
              loadingLabel={t("Applying to matching services…")}
              onClick={applyProjectDefaultToMatchingServices}
              size="compact"
              type="button"
              variant="secondary"
            >
              {t("Apply project default to matching services")}
            </Button>
          ) : null}
        </div>
      </form>

      {draftIsProjectDefault && hasServiceOverrides ? (
        <InlineAlert variant="info">
          {t(
            "Service overrides are still active for {countLabel}. Apply the project default when you want them to use {repo}.",
            {
              countLabel: serviceOverrideCountLabel,
              repo: boundRepo,
            },
          )}
        </InlineAlert>
      ) : null}

      {repoInstallationError ? (
        <InlineAlert variant="warning">{repoInstallationError}</InlineAlert>
      ) : null}

      {githubConnectionError ? (
        <InlineAlert variant="warning">{githubConnectionError}</InlineAlert>
      ) : null}

      {githubAppCallbackState === "github-app-install-failed" ? (
        <InlineAlert variant="warning">
          {t("GitHub authorization did not complete. Try connecting the repository again.")}
        </InlineAlert>
      ) : null}

      {githubStatusRows.length ? (
        <dl aria-live="polite" className="fg-project-image-sync__status-list">
          {githubStatusRows.map((row) => (
            <div className="fg-project-image-sync__status-row" key={row.key}>
              <dt>{row.label}</dt>
              <dd>
                {row.tone ? (
                  <StatusBadge live={row.live} tone={row.tone}>
                    {row.value}
                  </StatusBadge>
                ) : (
                  <strong>{row.value}</strong>
                )}
              </dd>
              <p>{row.detail}</p>
            </div>
          ))}
        </dl>
      ) : null}

      {status === "loading" ? (
        <p className="fg-console-note">{t("Loading image update settings…")}</p>
      ) : null}

      {response?.services.length ? (
        <div
          aria-label={t("Detected image services for {projectName}", {
            projectName,
          })}
          className="fg-project-image-sync__services"
          role="table"
        >
          <div
            className="fg-project-image-sync__service-row fg-project-image-sync__service-row--head"
            role="row"
          >
            <span role="columnheader">{t("Service")}</span>
            <span role="columnheader">{t("Image")}</span>
            <span role="columnheader">{t("Update strategy")}</span>
            <span role="columnheader">{t("Last activity")}</span>
          </div>
          {response.services.map((service) => {
            const scope = readServiceScope(service);
            const activity = readServiceActivity(service);

            return (
              <div
                className="fg-project-image-sync__service-row"
                key={service.appId}
                role="row"
              >
                <div
                  className="fg-project-image-sync__service-name"
                  data-label={t("Service")}
                  role="cell"
                >
                  <strong>{service.appName}</strong>
                  <span>{readServiceMeta(service) || t("App service")}</span>
                </div>
                <div
                  className="fg-project-image-sync__service-image"
                  data-label={t("Image")}
                  role="cell"
                >
                  <code title={service.imageRef ?? undefined}>
                    {service.imageRef || "—"}
                  </code>
                </div>
                <div
                  className="fg-project-image-sync__service-strategy"
                  data-label={t("Update strategy")}
                  role="cell"
                >
                  <StatusBadge
                    live={scope !== "none"}
                    tone={readStrategyTone(scope)}
                  >
                    {t(readStrategyLabel(scope))}
                  </StatusBadge>
                  <span>
                    {t(readTriggerLabel(service.tracking.trigger))}
                    {" / "}
                    {t(readStrategyDetail(service))}
                  </span>
                </div>
                <div
                  className="fg-project-image-sync__service-activity"
                  data-label={t("Last activity")}
                  role="cell"
                >
                  {activity.tone ? (
                    <StatusBadge tone={activity.tone}>{activity.value}</StatusBadge>
                  ) : (
                    <strong>{activity.value}</strong>
                  )}
                  <span>{activity.detail}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
