"use client";

import { useEffect, useState, type FormEvent } from "react";

import { useI18n } from "@/components/providers/i18n-provider";
import { StatusBadge } from "@/components/console/status-badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { HintInline } from "@/components/ui/hint-tooltip";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useToast } from "@/components/ui/toast";

type ProjectImageTrackingBinding = {
  enabled: boolean;
  fugueProjectId: string;
  githubRepo: string;
  id: string;
  updatedAt: string;
  userEmail: string;
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
  linkedCount: number;
  projectId: string;
  services: ProjectImageTrackingService[];
};

export interface ProjectImageTrackingPanelProps {
  disabled?: boolean;
  onLinked?: () => void;
  projectId: string;
  projectName: string;
}

type LoadState = "error" | "idle" | "loading" | "ready";

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

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(await readResponseError(response));
  }

  return (await response.json()) as T;
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

export function ProjectImageTrackingPanel({
  disabled = false,
  onLinked,
  projectId,
  projectName,
}: ProjectImageTrackingPanelProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [response, setResponse] = useState<ProjectImageTrackingResponse | null>(
    null,
  );
  const [status, setStatus] = useState<LoadState>("idle");
  const [repoDraft, setRepoDraft] = useState("");
  const [repoTouched, setRepoTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const repoError = readGitHubRepoError(repoDraft);
  const repoFieldError =
    (submitAttempted || repoDraft) && repoError ? t(repoError) : undefined;
  const normalizedRepo = normalizeGitHubRepoInput(repoDraft);
  const canSubmit =
    !disabled && !saving && status !== "loading" && repoTouched && !repoError;
  const linkedCount = response?.linkedCount ?? 0;
  const statusLabel =
    status === "error"
      ? t("Unavailable")
      : status === "loading"
      ? t("Loading")
      : linkedCount > 0
        ? t("{count} linked", { count: linkedCount })
        : t("Not linked");
  const statusTone =
    status === "error"
      ? ("warning" as const)
      : linkedCount > 0
        ? ("positive" as const)
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
        setRepoDraft(nextResponse.binding?.githubRepo ?? "");
        setRepoTouched(false);
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
  }, [projectId, showToast, t]);

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
      showToast({
        message: error instanceof Error ? error.message : t("Request failed."),
        variant: "error",
      });
    } finally {
      setSaving(false);
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

        <StatusBadge live={linkedCount > 0} tone={statusTone}>
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
            className="fg-input"
            disabled={disabled || saving}
            id={`project-image-repo-${projectId}`}
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
            placeholder="yym68686/uni-api-web"
            spellCheck={false}
            value={repoDraft}
          />
        </FormField>

        <div className="fg-settings-form__actions">
          <Button
            disabled={!canSubmit}
            loading={saving}
            loadingLabel={t("Binding…")}
            size="compact"
            type="submit"
            variant="primary"
          >
            {response?.binding ? t("Update repository") : t("Bind project")}
          </Button>
        </div>
      </form>

      {status === "loading" ? (
        <p className="fg-console-note">{t("Loading image update settings…")}</p>
      ) : null}

      {response?.services.length ? (
        <ul
          aria-label={t("Detected image services for {projectName}", {
            projectName,
          })}
          className="fg-project-image-sync__services"
        >
          {response.services.map((service) => (
            <li className="fg-project-image-sync__service" key={service.appId}>
              <div className="fg-project-image-sync__service-copy">
                <strong>{service.appName}</strong>
                <span>{readServiceMeta(service) || t("App service")}</span>
                {service.imageRef ? (
                  <code title={service.imageRef}>{service.imageRef}</code>
                ) : null}
              </div>
              <div className="fg-project-image-sync__service-status">
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
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
