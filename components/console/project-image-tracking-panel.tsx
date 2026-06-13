"use client";

import { useEffect, useState, type FormEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { useI18n } from "@/components/providers/i18n-provider";
import { StatusBadge } from "@/components/console/status-badge";
import { Button, ButtonAnchor } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { HintInline } from "@/components/ui/hint-tooltip";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useToast } from "@/components/ui/toast";
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
  updatedAt: string | null;
};

type ProjectImageTrackingResponse = {
  binding: ProjectImageTrackingBinding | null;
  githubApp: ProjectImageTrackingGitHubAppStatus;
  linkedCount: number;
  projectId: string;
  services: ProjectImageTrackingService[];
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

async function readResponseError(response: Response) {
  const body = await response.text().catch(() => "");
  const trimmed = body.trim();

  if (!trimmed) {
    return `Request failed with status ${response.status}.`;
  }

  try {
    const payload = JSON.parse(trimmed) as { error?: unknown };

    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    // Fall through to the raw body.
  }

  return trimmed;
}

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

function buildInstallReturnTo(returnTo: string, githubRepo: string) {
  const url = new URL(returnTo, "https://fugue.local");
  url.searchParams.set("githubImageRepo", githubRepo);
  return `${url.pathname}${url.search}`;
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
  const [repoTouched, setRepoTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const repoError = readGitHubRepoError(repoDraft);
  const repoFieldError =
    (submitAttempted || repoDraft) && repoError ? t(repoError) : undefined;
  const normalizedRepo = normalizeGitHubRepoInput(repoDraft);
  const currentReturnTo = currentSearch
    ? `${pathname}?${currentSearch}`
    : pathname;
  const boundRepo = response?.binding?.githubRepo ?? "";
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
  const currentRepoBound = Boolean(
    response?.binding?.enabled &&
      boundRepo &&
      normalizedRepo &&
      normalizedRepo === boundRepo,
  );
  const repoReadyForPolling = Boolean(appInstalled || publicRepoReady);
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
    repoTouched &&
    !repoError &&
    repoReadyForPolling;
  const linkedCount = response?.linkedCount ?? 0;
  const statusLabel =
    status === "error"
      ? t("Unavailable")
      : status === "loading"
        ? t("Loading")
        : repoInstallationLoading
          ? t("Checking…")
          : currentRepoBound && linkedCount > 0
            ? t("Registry polling enabled")
          : currentRepoBound
            ? t("Repository bound")
          : appInstalled
            ? t("GitHub App installed")
            : publicRepoReady
              ? t("Public repository")
              : hasRepoCandidate
                ? t("Install required")
                : t("Not configured");
  const statusTone =
    status === "error"
      ? ("warning" as const)
      : currentRepoBound
        ? ("positive" as const)
      : appInstalled
        ? ("positive" as const)
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
        setRepoTouched(Boolean(!nextResponse.binding && queryRepo));
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);

    if (!canSubmit) {
      return;
    }

    setSaving(true);

    try {
      const nextResponse = await requestJson<ProjectImageTrackingResponse>(
        `/api/fugue/projects/${projectId}/image-tracking`,
        {
          body: JSON.stringify({ githubRepo: normalizedRepo }),
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
      setRepoTouched(false);
      setSubmitAttempted(false);
      setStatus("ready");
      showToast({
        message: t("GitHub repository linked to {count} services.", {
          count: nextResponse.linkedCount,
        }),
        variant: "success",
      });
      onLinked?.();
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
    } finally {
      setSaving(false);
    }
  }

  const githubStatusRows: GitHubImageStatusRow[] = [];

  if (currentGitHubAppStatus && hasRepoCandidate) {
    githubStatusRows.push(
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
                "Public repositories can be bound for registry polling without installing the GitHub App.",
              )
            : t(
                "Install the GitHub App to verify private access and receive webhook events.",
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
          ? t("GitHub App installed")
          : publicRepoReady
            ? t("Public repository")
            : t("Not verified"),
      },
      {
        detail: currentRepoBound
          ? linkedCount > 0
            ? t("GitHub repository linked to {count} services.", {
                count: linkedCount,
              })
            : t("Repository is bound. No matching image service has been linked yet.")
          : repoReadyForPolling
            ? t(
                "Binding this repository enables registry polling. Install the GitHub App only if you also need webhook events.",
              )
            : t("Bind a repository after GitHub access is available."),
        key: "registry-polling",
        label: t("Registry polling"),
        live: currentRepoBound,
        tone: currentRepoBound
          ? "positive"
          : repoReadyForPolling
            ? "info"
            : "neutral",
        value: currentRepoBound
          ? t("Enabled")
          : repoReadyForPolling
            ? t("Ready to bind")
            : t("Not enabled"),
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
            : t("Install the GitHub App to receive webhook events."),
        key: "webhook",
        label: t("Webhook events"),
        live: webhookActive,
        tone: webhookActive ? "positive" : "neutral",
        value: webhookActive
          ? t("Active")
          : currentGitHubAppStatus.installed
            ? t("Inactive")
            : t("Not enabled"),
      },
    );

    if (
      currentRepoBound ||
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
            ariaLabel={t("GitHub repository")}
            hint={t(
              "Bind one repository for this project. Fugue reads the repository workflow image outputs and maps them to app services automatically.",
            )}
          >
            <h3 className="fg-route-subsection__title fg-ui-heading">
              {t("GitHub repository")}
            </h3>
          </HintInline>
        </div>

        <StatusBadge live={currentRepoBound || appInstalled} tone={statusTone}>
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
          label={t("Repository")}
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
              setRepoTouched(true);
            }}
            placeholder="yym68686/uni-api…"
            spellCheck={false}
            value={repoDraft}
          />
        </FormField>

        <div className="fg-settings-form__actions fg-project-image-sync__actions">
          {!appInstalled && installHref ? (
            <ButtonAnchor
              href={installHref}
              size="compact"
              variant="secondary"
            >
              {publicRepoReady ? t("Enable webhooks") : t("Install GitHub App")}
            </ButtonAnchor>
          ) : null}
          <Button
            disabled={!canSubmit}
            loading={saving}
            loadingLabel={t("Binding…")}
            size="compact"
            type="submit"
            variant="primary"
          >
            {response?.binding
              ? t("Update registry polling")
              : t("Enable registry polling")}
          </Button>
        </div>
      </form>

      {repoInstallationError ? (
        <InlineAlert variant="warning">{repoInstallationError}</InlineAlert>
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
            <span role="columnheader">{t("Source")}</span>
            <span role="columnheader">{t("Image")}</span>
            <span role="columnheader">{t("Status")}</span>
          </div>
          {response.services.map((service) => (
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
                <span>{t("App service")}</span>
              </div>
              <div
                className="fg-project-image-sync__service-meta"
                data-label={t("Source")}
                role="cell"
              >
                <span>{readServiceMeta(service) || "—"}</span>
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
                className="fg-project-image-sync__service-status"
                data-label={t("Status")}
                role="cell"
              >
                <StatusBadge
                  live={service.linked}
                  tone={service.linked ? "positive" : "neutral"}
                >
                  {service.linked ? t("Linked") : t("Waiting")}
                </StatusBadge>
                {service.matchReason ? (
                  <span>{t(service.matchReason)}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
