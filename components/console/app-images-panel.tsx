"use client";

import { useEffect, useState } from "react";

import { useI18n } from "@/components/providers/i18n-provider";
import { StatusBadge } from "@/components/console/status-badge";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { HintInline } from "@/components/ui/hint-tooltip";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useToast } from "@/components/ui/toast";
import type { TranslationValues } from "@/lib/i18n/core";
import { readGitHubCommitHref } from "@/lib/fugue/source-links";
import {
  readFugueSourceLabel,
  readFugueSourceMeta,
} from "@/lib/fugue/source-display";
import { copyText } from "@/lib/ui/clipboard";
import { cx } from "@/lib/ui/cx";
import {
  createAbortRequestError,
  isAbortRequestError,
} from "@/lib/ui/request-json";

type AppImageSource = {
  buildStrategy?: string | null;
  commitCommittedAt?: string | null;
  commitSha?: string | null;
  composeService?: string | null;
  detectedProvider?: string | null;
  detectedStack?: string | null;
  dockerfilePath?: string | null;
  imageRef?: string | null;
  repoBranch?: string | null;
  repoUrl?: string | null;
  resolvedImageRef?: string | null;
  sourceDir?: string | null;
  type?: string | null;
  uploadFilename?: string | null;
};

type AppImageSummary = {
  currentSizeBytes: number;
  currentVersionCount: number;
  reclaimableSizeBytes: number;
  staleSizeBytes: number;
  staleVersionCount: number;
  totalSizeBytes: number;
  versionCount: number;
};

type AppImageVersion = {
  current: boolean;
  deleteSupported: boolean;
  digest: string | null;
  imageRef: string;
  lastDeployedAt: string | null;
  reclaimableSizeBytes: number;
  redeploySupported: boolean;
  runtimeImageRef: string | null;
  sizeBytes: number | null;
  source: AppImageSource | null;
  status: string | null;
};

type AppImageInventoryResponse = {
  appId: string;
  registryConfigured: boolean;
  summary: AppImageSummary;
  versions: AppImageVersion[];
};

type AppImageDeleteResponse = {
  alreadyMissing: boolean;
  deleted: boolean;
  image: AppImageVersion | null;
  reclaimedSizeBytes: number;
  registryConfigured: boolean;
};

type AppImageRedeployResponse = {
  image: AppImageVersion | null;
  operation: {
    id?: string | null;
  } | null;
};

type AppImagesPanelProps = {
  appId: string;
  appName: string;
  onRequestRefreshWindow?: (durationMs?: number) => void;
};

type InventoryState = "error" | "idle" | "loading" | "ready";

const APP_IMAGE_CACHE_TTL_MS = 60_000;

type CachedAppImageInventory = {
  cachedAt: number;
  inventory: AppImageInventoryResponse;
};

const appImageInventoryCache = new Map<string, CachedAppImageInventory>();
const appImageInventoryRequestCache = new Map<
  string,
  Promise<AppImageInventoryResponse | null>
>();

type Translator = (key: string, values?: TranslationValues) => string;
type NumberFormatter = (value: number, options?: Intl.NumberFormatOptions) => string;
type DateTimeFormatter = (
  value?: string | number | Date | null,
  options?: {
    emptyText?: string;
    formatOptions?: Intl.DateTimeFormatOptions;
  },
) => string;
type RelativeTimeFormatter = (
  value?: string | number | Date | null,
  options?: {
    justNowText?: string;
    notYetText?: string;
  },
) => string;

function formatCompactNumber(
  value: number,
  digits = 1,
  formatNumber: NumberFormatter,
) {
  return formatNumber(value, {
    maximumFractionDigits: digits,
    minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(1, digits),
  });
}

function formatBytesLabel(
  value: number | null | undefined,
  formatNumber: NumberFormatter,
  t: Translator,
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return t("No stats");
  }

  const units = ["bytes", "KB", "MB", "GB", "TB", "PB"];
  let amount = value;
  let unitIndex = 0;

  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }

  const digits = amount >= 100 || unitIndex === 0 ? 0 : 1;

  if (unitIndex === 0) {
    const rounded = Math.round(amount);
    return t(rounded === 1 ? "{count} byte" : "{count} bytes", {
      count: rounded,
    });
  }

  return t("{value} {unit}", {
    unit: units[unitIndex],
    value: formatCompactNumber(amount, digits, formatNumber),
  });
}

function parseTimestamp(value?: string | null) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatExactTime(
  value: string | null | undefined,
  formatDateTime: DateTimeFormatter,
  t: Translator,
) {
  return formatDateTime(value, {
    emptyText: t("Unknown"),
    formatOptions: {
      dateStyle: "medium",
      timeStyle: "short",
    },
  });
}

function formatRelativeTime(
  value: string | null | undefined,
  formatRelativeTimeValue: RelativeTimeFormatter,
  t: Translator,
) {
  return formatRelativeTimeValue(value, {
    justNowText: t("Just now"),
    notYetText: t("Unknown"),
  });
}

function readErrorMessage(error: unknown, t: Translator = (key) => key) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return t("Request failed.");
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

function shortHash(value?: string | null, length = 12) {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized.slice(0, length) : null;
}

function readVersionTitle(version: AppImageVersion, t: Translator) {
  const sourceLabel = readFugueSourceLabel(version.source);

  if (sourceLabel && sourceLabel !== "Unspecified source") {
    return sourceLabel;
  }

  return version.current
    ? t("Current managed image")
    : t("Saved managed image");
}

function readVersionSubtitle(
  version: AppImageVersion,
  formatRelativeTimeValue: RelativeTimeFormatter,
  t: Translator,
) {
  const details = [readFugueSourceMeta(version.source)];

  if (version.lastDeployedAt) {
    details.push(
      t("Last deployed {time}", {
        time: formatRelativeTime(version.lastDeployedAt, formatRelativeTimeValue, t),
      }),
    );
  }

  return details
    .filter((value): value is string => Boolean(value) && value !== t("Unknown"))
    .join(" / ");
}

function readVersionTone(version: AppImageVersion) {
  if (version.current) {
    return "positive" as const;
  }

  if (version.status === "available") {
    return "info" as const;
  }

  return "warning" as const;
}

function readVersionStatusLabel(version: AppImageVersion, t: Translator) {
  if (version.current) {
    return t("Current");
  }

  if (version.status === "available") {
    return t("Saved");
  }

  return t("Missing");
}

function readDeleteDescription(
  version: AppImageVersion,
  appName: string,
  t: Translator,
) {
  const details = [
    t("{title} will be removed from {appName}'s saved image history.", {
      appName,
      title: readVersionTitle(version, t),
    }),
  ];

  if (version.reclaimableSizeBytes <= 0) {
    details.push(
      t("Most image data for this version is still shared with other saved images."),
    );
  }

  return details.join(" ");
}

function readClearHistoryDescription(
  versions: AppImageVersion[],
  appName: string,
  reclaimableSizeBytes: number,
  t: Translator,
) {
  const parts = [
    t(
      versions.length === 1
        ? "{count} saved image version will be removed from {appName}."
        : "{count} saved image versions will be removed from {appName}.",
      {
        appName,
        count: versions.length,
      },
    ),
  ];

  if (reclaimableSizeBytes <= 0) {
    parts.push(
      t("Most image data in this history is still shared with other saved images."),
    );
  }

  return parts.join(" ");
}

function buildClearHistoryToast(
  deletedCount: number,
  alreadyMissingCount: number,
  failedCount: number,
  t: Translator,
) {
  const parts: string[] = [];

  if (deletedCount > 0) {
    parts.push(
      t(
        deletedCount === 1
          ? "Deleted {count} saved image version."
          : "Deleted {count} saved image versions.",
        {
          count: deletedCount,
        },
      ),
    );
  }

  if (alreadyMissingCount > 0) {
    parts.push(
      t(
        alreadyMissingCount === 1
          ? "{count} version was already missing."
          : "{count} versions were already missing.",
        {
          count: alreadyMissingCount,
        },
      ),
    );
  }

  if (failedCount > 0) {
    parts.push(
      t(
        failedCount === 1
          ? "Failed to remove {count} version."
          : "Failed to remove {count} versions.",
        {
          count: failedCount,
        },
      ),
    );
  }

  return {
    message: parts.join(" ") || t("Saved image history updated."),
    variant: failedCount > 0 ? ("error" as const) : ("success" as const),
  };
}

function readCommitHref(source?: AppImageSource | null) {
  return readGitHubCommitHref(source?.repoUrl, source?.commitSha);
}

function readRuntimeImageRef(version: AppImageVersion) {
  if (
    !version.runtimeImageRef ||
    version.runtimeImageRef === version.imageRef
  ) {
    return null;
  }

  return version.runtimeImageRef;
}

function sortImageVersions(versions: AppImageVersion[]) {
  return [...versions].sort((left, right) => {
    if (left.current !== right.current) {
      return left.current ? -1 : 1;
    }

    const leftTimestamp = parseTimestamp(left.lastDeployedAt);
    const rightTimestamp = parseTimestamp(right.lastDeployedAt);

    if (leftTimestamp !== rightTimestamp) {
      return rightTimestamp - leftTimestamp;
    }

    return left.imageRef.localeCompare(right.imageRef);
  });
}

function buildInventorySummary(versions: AppImageVersion[]): AppImageSummary {
  let currentSizeBytes = 0;
  let currentVersionCount = 0;
  let reclaimableSizeBytes = 0;
  let staleSizeBytes = 0;
  let staleVersionCount = 0;
  let totalSizeBytes = 0;

  for (const version of versions) {
    const sizeBytes =
      typeof version.sizeBytes === "number" && Number.isFinite(version.sizeBytes)
        ? Math.max(version.sizeBytes, 0)
        : 0;

    totalSizeBytes += sizeBytes;
    reclaimableSizeBytes += Math.max(version.reclaimableSizeBytes ?? 0, 0);

    if (version.current) {
      currentVersionCount += 1;
      currentSizeBytes += sizeBytes;
      continue;
    }

    staleVersionCount += 1;
    staleSizeBytes += sizeBytes;
  }

  return {
    currentSizeBytes,
    currentVersionCount,
    reclaimableSizeBytes,
    staleSizeBytes,
    staleVersionCount,
    totalSizeBytes,
    versionCount: versions.length,
  };
}

function readCachedInventory(appId: string) {
  const cached = appImageInventoryCache.get(appId);

  if (!cached) {
    return null;
  }

  if (Date.now() - cached.cachedAt > APP_IMAGE_CACHE_TTL_MS) {
    appImageInventoryCache.delete(appId);
    return null;
  }

  return cached.inventory;
}

function writeCachedInventory(
  appId: string,
  inventory: AppImageInventoryResponse | null,
) {
  if (!inventory) {
    appImageInventoryCache.delete(appId);
    return;
  }

  appImageInventoryCache.set(appId, {
    cachedAt: Date.now(),
    inventory,
  });
}

export function readCachedAppImageInventory(appId: string) {
  return readCachedInventory(appId);
}

async function fetchAppImageInventory(
  appId: string,
  options?: {
    force?: boolean;
    signal?: AbortSignal;
  },
) {
  if (options?.signal?.aborted) {
    throw createAbortRequestError();
  }

  if (!options?.force) {
    const cachedInventory = readCachedInventory(appId);

    if (cachedInventory) {
      return cachedInventory;
    }

    const pendingRequest = appImageInventoryRequestCache.get(appId);

    if (pendingRequest) {
      return pendingRequest;
    }
  }

  const request = requestJson<AppImageInventoryResponse>(
    `/api/fugue/apps/${appId}/images`,
    {
      cache: "no-store",
      signal: options?.signal,
    },
  )
    .then((response) => {
      writeCachedInventory(appId, response);
      return readCachedInventory(appId) ?? response;
    })
    .finally(() => {
      if (appImageInventoryRequestCache.get(appId) === request) {
        appImageInventoryRequestCache.delete(appId);
      }
    });

  appImageInventoryRequestCache.set(appId, request);
  return request;
}

export async function warmAppImageInventory(
  appId: string,
  options?: {
    force?: boolean;
    signal?: AbortSignal;
  },
) {
  try {
    return await fetchAppImageInventory(appId, options);
  } catch (error) {
    if (options?.signal?.aborted || isAbortRequestError(error)) {
      return null;
    }

    throw error;
  }
}

export function AppImagesPanel({
  appId,
  appName,
  onRequestRefreshWindow,
}: AppImagesPanelProps) {
  const { formatDateTime, formatNumber, formatRelativeTime: formatRelativeTimeValue, t } = useI18n();
  const confirm = useConfirmDialog();
  const { showToast } = useToast();
  const [inventory, setInventory] = useState<AppImageInventoryResponse | null>(
    () => readCachedInventory(appId),
  );
  const [status, setStatus] = useState<InventoryState>(() =>
    readCachedInventory(appId) ? "ready" : "idle",
  );
  const [refreshing, setRefreshing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cachedInventory = readCachedInventory(appId);

    if (cachedInventory) {
      setInventory(cachedInventory);
      setStatus("ready");
      if (refreshToken === 0) {
        setRefreshing(false);
        return () => {
          cancelled = true;
        };
      }

      setRefreshing(true);
    } else {
      setStatus("loading");
      setRefreshing(false);
    }

    fetchAppImageInventory(appId, {
      force: refreshToken > 0,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }

        writeCachedInventory(appId, response);
        setInventory(response);
        setStatus("ready");
        setRefreshing(false);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        if (!cachedInventory) {
          setStatus("error");
        }
        setRefreshing(false);
        showToast({
          message: readErrorMessage(error, t),
          variant: "error",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [appId, refreshToken, showToast, t]);

  const currentVersions =
    inventory?.versions.filter((version) => version.current) ?? [];
  const historicalVersions =
    inventory?.versions.filter((version) => !version.current) ?? [];
  const clearableVersions = historicalVersions.filter(
    (version) => version.deleteSupported,
  );
  const clearHistoryKey = "clear-history";
  const formatBytes = (value?: number | null) =>
    formatBytesLabel(value, formatNumber, t);
  const formatExact = (value?: string | null) =>
    formatExactTime(value, formatDateTime, t);
  const formatRelative = (value?: string | null) =>
    formatRelativeTime(value, formatRelativeTimeValue, t);

  function applyInventory(
    nextInventory:
      | AppImageInventoryResponse
      | null
      | ((
          current: AppImageInventoryResponse | null,
        ) => AppImageInventoryResponse | null),
  ) {
    setInventory((current) => {
      const resolvedInventory =
        typeof nextInventory === "function" ? nextInventory(current) : nextInventory;
      writeCachedInventory(appId, resolvedInventory);
      return resolvedInventory;
    });
  }

  function removeVersionsFromInventory(imageRefs: Iterable<string>) {
    const imageRefSet = new Set(imageRefs);

    if (imageRefSet.size === 0) {
      return;
    }

    applyInventory((currentInventory) => {
      if (!currentInventory) {
        return currentInventory;
      }

      const nextVersions = sortImageVersions(
        currentInventory.versions.filter(
          (version) => !imageRefSet.has(version.imageRef),
        ),
      );

      return {
        ...currentInventory,
        summary: buildInventorySummary(nextVersions),
        versions: nextVersions,
      };
    });
  }

  async function handleCopy(value: string, label: string) {
    try {
      await copyText(value);
      showToast({
        message: t("{label} copied.", { label }),
        variant: "success",
      });
    } catch {
      showToast({
        message: t("Unable to copy {label}.", {
          label: label.toLowerCase(),
        }),
        variant: "error",
      });
    }
  }

  async function deleteVersion(version: AppImageVersion) {
    return requestJson<AppImageDeleteResponse>(
      `/api/fugue/apps/${appId}/images/delete`,
      {
        body: JSON.stringify({ imageRef: version.imageRef }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
  }

  async function handleRedeploy(version: AppImageVersion) {
    const actionKey = `redeploy:${version.imageRef}`;

    if (busyKey) {
      return;
    }

    setBusyKey(actionKey);

    try {
      const response = await requestJson<AppImageRedeployResponse>(
        `/api/fugue/apps/${appId}/images/redeploy`,
        {
          body: JSON.stringify({ imageRef: version.imageRef }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      showToast({
        message: response?.operation?.id
          ? t("Historical image queued for deploy.")
          : t("Historical image selected for deploy."),
        variant: "success",
      });
      onRequestRefreshWindow?.(90_000);
    } catch (error) {
      showToast({
        message: readErrorMessage(error, t),
        variant: "error",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDelete(version: AppImageVersion) {
    const actionKey = `delete:${version.imageRef}`;

    if (busyKey) {
      return;
    }

    const confirmed = await confirm({
      confirmLabel: t("Delete image"),
      description: readDeleteDescription(version, appName, t),
      title: t("Delete saved image?"),
    });

    if (!confirmed) {
      return;
    }

    setBusyKey(actionKey);

    try {
      const response = await deleteVersion(version);

      if (response?.deleted || response?.alreadyMissing) {
        removeVersionsFromInventory([version.imageRef]);
      }

      showToast({
        message: response?.alreadyMissing
          ? t("Saved image was already missing.")
          : t("Saved image deleted."),
        variant: "success",
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error, t),
        variant: "error",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleClearHistory() {
    if (busyKey || clearableVersions.length === 0) {
      return;
    }

    const confirmed = await confirm({
      confirmLabel: t("Clear history"),
      description: readClearHistoryDescription(
        clearableVersions,
        appName,
        inventory?.summary.reclaimableSizeBytes ?? 0,
        t,
      ),
      title: t("Delete all saved images?"),
    });

    if (!confirmed) {
      return;
    }

    setBusyKey(clearHistoryKey);

    let deletedCount = 0;
    let alreadyMissingCount = 0;
    let failedCount = 0;
    const removedImageRefs: string[] = [];

    for (const version of clearableVersions) {
      try {
        const response = await deleteVersion(version);

        if (response?.alreadyMissing) {
          alreadyMissingCount += 1;
          removedImageRefs.push(version.imageRef);
          continue;
        }

        if (response?.deleted) {
          deletedCount += 1;
          removedImageRefs.push(version.imageRef);
          continue;
        }

        failedCount += 1;
      } catch {
        failedCount += 1;
      }
    }

    removeVersionsFromInventory(removedImageRefs);
    showToast(
      buildClearHistoryToast(
        deletedCount,
        alreadyMissingCount,
        failedCount,
        t,
      ),
    );
    setBusyKey(null);
  }

  function renderVersion(version: AppImageVersion) {
    const actionDisabled = Boolean(busyKey);
    const redeployKey = `redeploy:${version.imageRef}`;
    const deleteKey = `delete:${version.imageRef}`;
    const commitHref = readCommitHref(version.source);
    const runtimeImageRef = readRuntimeImageRef(version);

    return (
      <article
        className={cx(
          "fg-app-images__card",
          version.current && "is-current",
          version.status !== "available" && "is-missing",
        )}
        key={version.imageRef}
      >
        <div className="fg-app-images__card-head">
          <div className="fg-app-images__card-copy">
            <div className="fg-app-images__card-badges">
              <StatusBadge
                live={version.current}
                tone={readVersionTone(version)}
              >
                {readVersionStatusLabel(version, t)}
              </StatusBadge>
              {version.source?.commitSha ? (
                <span className="fg-app-images__chip">
                  {t("Commit {hash}", {
                    hash: shortHash(version.source.commitSha) ?? "",
                  })}
                </span>
              ) : null}
              {version.source?.uploadFilename ? (
                <span className="fg-app-images__chip">
                  {version.source.uploadFilename}
                </span>
              ) : null}
            </div>
            <strong className="fg-app-images__card-title">
              {readVersionTitle(version, t)}
            </strong>
            <p className="fg-app-images__card-meta">
              {readVersionSubtitle(version, formatRelativeTimeValue, t)}
            </p>
          </div>

          <div className="fg-app-images__card-actions">
            <Button
              onClick={() => {
                void handleCopy(version.imageRef, t("Image reference"));
              }}
              size="compact"
              type="button"
              variant="ghost"
            >
              {t("Copy ref")}
            </Button>
            {!version.current && version.redeploySupported ? (
              <Button
                disabled={actionDisabled && busyKey !== redeployKey}
                loading={busyKey === redeployKey}
                loadingLabel={t("Queueing…")}
                onClick={() => {
                  void handleRedeploy(version);
                }}
                size="compact"
                type="button"
                variant="secondary"
              >
                {t("Redeploy")}
              </Button>
            ) : null}
            {!version.current && version.deleteSupported ? (
              <Button
                disabled={actionDisabled && busyKey !== deleteKey}
                loading={busyKey === deleteKey}
                loadingLabel={t("Deleting…")}
                onClick={() => {
                  void handleDelete(version);
                }}
                size="compact"
                type="button"
                variant="danger"
              >
                {t("Delete")}
              </Button>
            ) : null}
          </div>
        </div>

        <dl className="fg-app-images__details">
          <div>
            <dt>{t("Image ref")}</dt>
            <dd className="fg-app-images__mono" title={version.imageRef}>
              {version.imageRef}
            </dd>
          </div>
          {runtimeImageRef ? (
            <div>
              <dt>{t("Runtime ref")}</dt>
              <dd className="fg-app-images__mono" title={runtimeImageRef}>
                {runtimeImageRef}
              </dd>
            </div>
          ) : null}
          {version.digest ? (
            <div>
              <dt>{t("Digest")}</dt>
              <dd className="fg-app-images__mono" title={version.digest}>
                {version.digest}
              </dd>
            </div>
          ) : null}
          <div>
            <dt>{t("Stored size")}</dt>
            <dd>{formatBytes(version.sizeBytes)}</dd>
          </div>
          {version.lastDeployedAt ? (
            <div>
              <dt>{t("Last deployed")}</dt>
              <dd title={formatExact(version.lastDeployedAt)}>
                {formatRelative(version.lastDeployedAt)}
              </dd>
            </div>
          ) : null}
          {commitHref ? (
            <div>
              <dt>{t("Commit")}</dt>
              <dd>
                <a
                  className="fg-app-images__link"
                  href={commitHref}
                  rel="noreferrer"
                  target="_blank"
                >
                  {shortHash(version.source?.commitSha) ?? t("Open commit")}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      </article>
    );
  }

  return (
    <div className="fg-workbench-section fg-app-images">
      <div className="fg-workbench-section__head">
        <div className="fg-workbench-section__copy fg-app-images__copy">
          <HintInline
            ariaLabel={t("Images")}
            hint={t(
              "Review the current managed image and older saved versions for {appName}. Image storage is tracked separately from live service disk usage here, and stale versions can be redeployed or removed.",
              {
                appName,
              },
            )}
          >
            <p className="fg-label fg-panel__eyebrow">{t("Images")}</p>
          </HintInline>
        </div>

        <div className="fg-workbench-section__actions">
          <Button
            disabled={status === "loading" || refreshing || Boolean(busyKey)}
            loading={refreshing}
            loadingLabel={t("Refreshing…")}
            onClick={() => {
              setRefreshToken((value) => value + 1);
            }}
            size="compact"
            type="button"
            variant="secondary"
          >
            {t("Refresh now")}
          </Button>
          {inventory?.registryConfigured && clearableVersions.length > 0 ? (
            <Button
              disabled={Boolean(busyKey && busyKey !== clearHistoryKey)}
              loading={busyKey === clearHistoryKey}
              loadingLabel={t("Clearing…")}
              onClick={() => {
                void handleClearHistory();
              }}
              size="compact"
              type="button"
              variant="danger"
            >
              {t("Clear history")}
            </Button>
          ) : null}
        </div>
      </div>

      {status === "loading" && !inventory ? (
        <p className="fg-console-note">{t("Loading saved images…")}</p>
      ) : null}

      {status === "error" ? (
        <InlineAlert variant="error">
          {t("Unable to load saved images right now. Try refreshing this panel.")}
        </InlineAlert>
      ) : null}

      {status === "ready" && inventory ? (
        <>
          {!inventory.registryConfigured ? (
            <InlineAlert variant="info">
              {t("Internal registry inventory is not configured for this workspace yet.")}
            </InlineAlert>
          ) : null}

          {inventory.registryConfigured ? (
            <div className="fg-app-images__summary-grid">
              <article className="fg-app-images__summary-card">
                <span>{t("Total image storage")}</span>
                <strong>
                  {formatBytes(inventory.summary.totalSizeBytes)}
                </strong>
                <p>
                  {t(
                    inventory.summary.versionCount === 1
                      ? "{count} version"
                      : "{count} versions",
                    {
                      count: inventory.summary.versionCount,
                    },
                  )}
                </p>
              </article>
              <article className="fg-app-images__summary-card">
                <span>{t("Current release")}</span>
                <strong>
                  {formatBytes(inventory.summary.currentSizeBytes)}
                </strong>
                <p>
                  {t(
                    inventory.summary.currentVersionCount === 1
                      ? "{count} active version"
                      : "{count} active versions",
                    {
                      count: inventory.summary.currentVersionCount,
                    },
                  )}
                </p>
              </article>
              <article className="fg-app-images__summary-card">
                <span>{t("Saved history")}</span>
                <strong>
                  {formatBytes(inventory.summary.staleSizeBytes)}
                </strong>
                <p>
                  {t(
                    inventory.summary.staleVersionCount === 1
                      ? "{count} old version"
                      : "{count} old versions",
                    {
                      count: inventory.summary.staleVersionCount,
                    },
                  )}
                </p>
              </article>
            </div>
          ) : null}

          {inventory.registryConfigured ? (
            inventory.summary.versionCount === 0 ? (
              <div className="fg-app-images__empty">
                <strong>{t("No managed image history yet.")}</strong>
                <p>
                  {t(
                    "Historical versions appear here after the app has been imported or redeployed through Fugue.",
                  )}
                </p>
              </div>
            ) : (
              <div className="fg-app-images__sections">
                {currentVersions.length ? (
                  <section className="fg-app-images__section">
                    <div className="fg-app-images__section-head">
                      <div>
                        <HintInline
                          ariaLabel={t("Current release")}
                          hint={t("The image version that currently represents this app.")}
                        >
                          <p className="fg-label fg-panel__eyebrow">
                            {t("Current release")}
                          </p>
                        </HintInline>
                      </div>
                    </div>
                    <div className="fg-app-images__list">
                      {currentVersions.map((version) => renderVersion(version))}
                    </div>
                  </section>
                ) : null}

                <section className="fg-app-images__section">
                  <div className="fg-app-images__section-head">
                    <div>
                      <HintInline
                        ariaLabel={t("Saved history")}
                        hint={t(
                          "Redeploy a known-good version, or delete stale images you no longer need.",
                        )}
                      >
                        <p className="fg-label fg-panel__eyebrow">
                          {t("Saved history")}
                        </p>
                      </HintInline>
                    </div>
                  </div>

                  {historicalVersions.length ? (
                    <div className="fg-app-images__list">
                      {historicalVersions.map((version) =>
                        renderVersion(version),
                      )}
                    </div>
                  ) : (
                    <div className="fg-app-images__empty fg-app-images__empty--compact">
                      <strong>{t("No stale images to clean up.")}</strong>
                      <p>{t("Only the current managed image is stored right now.")}</p>
                    </div>
                  )}
                </section>
              </div>
            )
          ) : null}
        </>
      ) : null}
    </div>
  );
}
