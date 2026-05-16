"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useI18n } from "@/components/providers/i18n-provider";
import { StatusBadge } from "@/components/console/status-badge";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
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

type AppImageTracking = {
  appId: string;
  createdAt: string | null;
  enabled: boolean;
  id: string;
  imageRef: string;
  lastCheckedAt: string | null;
  lastDeployedDigest: string | null;
  lastDeliveryId: string | null;
  lastError: string | null;
  lastEvent: string | null;
  lastOperationId: string | null;
  lastQueuedDigest: string | null;
  lastSeenDigest: string | null;
  lastTriggeredAt: string | null;
  tenantId: string;
  updatedAt: string | null;
};

type GitHubAppImageLink = {
  enabled: boolean;
  fugueAppId: string;
  githubInstallationId: string | null;
  githubPackage: string | null;
  githubRepo: string;
  githubWorkflow: string | null;
  id: string;
  imageRef: string;
  updatedAt: string;
  userEmail: string;
};

type AppImageTrackingResponse = {
  appId: string;
  githubLink?: GitHubAppImageLink | null;
  tracking: AppImageTracking | null;
};

type AppImageSyncResponse = {
  alreadyCurrent: boolean;
  appId: string;
  changed: boolean;
  digest: string | null;
  message: string | null;
  operation: {
    id?: string | null;
  } | null;
  tracking: AppImageTracking | null;
};

type AppImagesPanelProps = {
  appId: string;
  appName: string;
  onRequestRefreshWindow?: (durationMs?: number) => void;
  source?: AppImageSource | null;
};

type InventoryState = "error" | "idle" | "loading" | "ready";
type TrackingState = "error" | "idle" | "loading" | "ready";

type TrackingDraft = {
  enabled: boolean;
  githubInstallationId: string;
  githubPackage: string;
  githubRepo: string;
  githubWorkflow: string;
  imageRef: string;
};

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

function normalizeText(value?: string | null) {
  return value?.trim() ?? "";
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

function isValidGitHubRepoName(value: string) {
  return /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(value);
}

function readGitHubRepoError(value: string, t: Translator) {
  const normalized = normalizeGitHubRepoInput(value);

  if (!normalized) {
    return t("GitHub repository is required.");
  }

  if (!isValidGitHubRepoName(normalized)) {
    return t("Use owner/repo or a GitHub repository URL.");
  }

  return null;
}

function readSuggestedGitHubRepo(source?: AppImageSource | null) {
  const normalized = normalizeGitHubRepoInput(source?.repoUrl ?? "");
  return isValidGitHubRepoName(normalized) ? normalized : "";
}

function readSuggestedImageRef(
  source: AppImageSource | null | undefined,
  currentVersions: AppImageVersion[],
) {
  const sourceImageRef = normalizeText(source?.imageRef);

  if (sourceImageRef) {
    return sourceImageRef;
  }

  for (const version of currentVersions) {
    const versionSourceRef = normalizeText(version.source?.imageRef);

    if (versionSourceRef) {
      return versionSourceRef;
    }
  }

  return "";
}

function buildTrackingDraft(
  response: AppImageTrackingResponse | null,
  source: AppImageSource | null | undefined,
  currentVersions: AppImageVersion[],
): TrackingDraft {
  const tracking = response?.tracking ?? null;
  const githubLink = response?.githubLink ?? null;

  return {
    enabled: tracking?.enabled ?? githubLink?.enabled ?? true,
    githubInstallationId: githubLink?.githubInstallationId ?? "",
    githubPackage: githubLink?.githubPackage ?? "",
    githubRepo: githubLink?.githubRepo ?? readSuggestedGitHubRepo(source),
    githubWorkflow: githubLink?.githubWorkflow ?? "",
    imageRef:
      tracking?.imageRef ??
      githubLink?.imageRef ??
      readSuggestedImageRef(source, currentVersions),
  };
}

function readTrackingStatusLabel(
  response: AppImageTrackingResponse | null,
  state: TrackingState,
  t: Translator,
) {
  if (state === "loading" || state === "idle") {
    return t("Loading");
  }

  if (state === "error") {
    return t("Unavailable");
  }

  if (!response?.tracking) {
    return t("Not linked");
  }

  return response.tracking.enabled ? t("Linked") : t("Paused");
}

function readTrackingStatusTone(
  response: AppImageTrackingResponse | null,
  state: TrackingState,
) {
  if (state === "error") {
    return "warning" as const;
  }

  if (response?.tracking?.enabled) {
    return "positive" as const;
  }

  if (response?.tracking) {
    return "neutral" as const;
  }

  return "neutral" as const;
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
  source,
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
  const [trackingResponse, setTrackingResponse] =
    useState<AppImageTrackingResponse | null>(null);
  const [trackingState, setTrackingState] = useState<TrackingState>("idle");
  const [trackingDraft, setTrackingDraft] = useState<TrackingDraft>(() =>
    buildTrackingDraft(null, source, []),
  );
  const [trackingTouched, setTrackingTouched] = useState(false);
  const [trackingSubmitAttempted, setTrackingSubmitAttempted] = useState(false);
  const [trackingSaving, setTrackingSaving] = useState(false);
  const [trackingSyncing, setTrackingSyncing] = useState(false);

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

  const currentVersions = useMemo(
    () => inventory?.versions.filter((version) => version.current) ?? [],
    [inventory?.versions],
  );
  const historicalVersions = useMemo(
    () => inventory?.versions.filter((version) => !version.current) ?? [],
    [inventory?.versions],
  );
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
  const normalizedTrackingImageRef = normalizeText(trackingDraft.imageRef);
  const normalizedTrackingRepo = normalizeGitHubRepoInput(
    trackingDraft.githubRepo,
  );
  const trackingImageRefError = normalizedTrackingImageRef
    ? null
    : t("Image reference is required.");
  const trackingRepoError = readGitHubRepoError(trackingDraft.githubRepo, t);
  const trackingInputsDisabled = trackingSaving || trackingSyncing;
  const canSaveTracking =
    !trackingInputsDisabled &&
    trackingState !== "loading" &&
    !trackingImageRefError &&
    !trackingRepoError;
  const canSyncTracking =
    !trackingInputsDisabled &&
    Boolean(trackingResponse?.tracking) &&
    !trackingImageRefError;

  useEffect(() => {
    let cancelled = false;

    setTrackingState("loading");
    requestJson<AppImageTrackingResponse>(
      `/api/fugue/apps/${appId}/image-tracking`,
    )
      .then((response) => {
        if (cancelled) {
          return;
        }

        const nextResponse = response ?? {
          appId,
          githubLink: null,
          tracking: null,
        };

        setTrackingResponse(nextResponse);
        setTrackingDraft(
          buildTrackingDraft(nextResponse, source, currentVersions),
        );
        setTrackingTouched(false);
        setTrackingSubmitAttempted(false);
        setTrackingState("ready");
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setTrackingState("error");
        showToast({
          message: readErrorMessage(error, t),
          variant: "error",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [appId, showToast, t]);

  useEffect(() => {
    if (trackingTouched) {
      return;
    }

    setTrackingDraft(
      buildTrackingDraft(trackingResponse, source, currentVersions),
    );
  }, [currentVersions, source, trackingResponse, trackingTouched]);

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

  function updateTrackingDraft(next: Partial<TrackingDraft>) {
    setTrackingTouched(true);
    setTrackingDraft((current) => ({ ...current, ...next }));
  }

  async function handleTrackingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTrackingSubmitAttempted(true);

    if (trackingImageRefError || trackingRepoError || trackingSaving) {
      return;
    }

    setTrackingSaving(true);

    try {
      const response = await requestJson<AppImageTrackingResponse>(
        `/api/fugue/apps/${appId}/image-tracking`,
        {
          body: JSON.stringify({
            enabled: trackingDraft.enabled,
            githubInstallationId: normalizeText(
              trackingDraft.githubInstallationId,
            ),
            githubPackage: normalizeText(trackingDraft.githubPackage),
            githubRepo: normalizedTrackingRepo,
            githubWorkflow: normalizeText(trackingDraft.githubWorkflow),
            imageRef: normalizedTrackingImageRef,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PUT",
        },
      );
      const nextResponse = response ?? {
        appId,
        githubLink: null,
        tracking: null,
      };

      setTrackingResponse(nextResponse);
      setTrackingDraft(
        buildTrackingDraft(nextResponse, source, currentVersions),
      );
      setTrackingTouched(false);
      setTrackingSubmitAttempted(false);
      setTrackingState("ready");
      showToast({
        message: trackingDraft.enabled
          ? t("GitHub repository linked.")
          : t("GitHub image sync paused."),
        variant: "success",
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error, t),
        variant: "error",
      });
    } finally {
      setTrackingSaving(false);
    }
  }

  async function handleTrackingSyncNow() {
    if (!canSyncTracking) {
      return;
    }

    setTrackingSyncing(true);

    try {
      const response = await requestJson<AppImageSyncResponse>(
        `/api/fugue/apps/${appId}/image-sync`,
        {
          body: JSON.stringify({
            event: "manual",
            imageRef: normalizedTrackingImageRef,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      if (response?.tracking) {
        setTrackingResponse((current) => ({
          appId,
          githubLink: current?.githubLink ?? null,
          tracking: response.tracking,
        }));
      }

      if (response?.operation?.id) {
        onRequestRefreshWindow?.(90_000);
      }

      showToast({
        message: response?.operation?.id
          ? t("Image update queued.")
          : response?.alreadyCurrent
            ? t("Image already current.")
            : t("Image checked."),
        variant: "success",
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error, t),
        variant: "error",
      });
    } finally {
      setTrackingSyncing(false);
    }
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

  function renderTrackingPanel() {
    const tracking = trackingResponse?.tracking ?? null;
    const githubLink = trackingResponse?.githubLink ?? null;
    const trackingStatusLabel = readTrackingStatusLabel(
      trackingResponse,
      trackingState,
      t,
    );
    const trackingStatusTone = readTrackingStatusTone(
      trackingResponse,
      trackingState,
    );

    return (
      <section
        aria-label={t("GitHub image sync")}
        className="fg-app-images__tracking"
      >
        <div className="fg-app-images__tracking-head">
          <div className="fg-app-images__tracking-copy">
            <HintInline
              ariaLabel={t("GitHub image sync")}
              hint={t(
                "Bind the GitHub repository that publishes this image. Matching GitHub App webhooks trigger Fugue to check and deploy the latest digest.",
              )}
            >
              <p className="fg-label fg-panel__eyebrow">
                {t("GitHub image sync")}
              </p>
            </HintInline>
            <strong>{t("Repository binding")}</strong>
          </div>

          <StatusBadge
            live={trackingState === "ready" && Boolean(tracking?.enabled)}
            tone={trackingStatusTone}
          >
            {trackingStatusLabel}
          </StatusBadge>
        </div>

        {trackingState === "error" ? (
          <InlineAlert variant="error">
            {t("Unable to load GitHub image sync settings right now.")}
          </InlineAlert>
        ) : null}

        <form
          className="fg-app-images__tracking-form"
          onSubmit={handleTrackingSubmit}
        >
          <div className="fg-app-images__tracking-grid">
            <FormField
              error={
                trackingSubmitAttempted || trackingDraft.imageRef
                  ? trackingImageRefError ?? undefined
                  : undefined
              }
              htmlFor={`image-tracking-ref-${appId}`}
              label={t("Image ref")}
            >
              <input
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                className="fg-input"
                disabled={trackingInputsDisabled}
                id={`image-tracking-ref-${appId}`}
                onChange={(event) =>
                  updateTrackingDraft({ imageRef: event.target.value })
                }
                placeholder="ghcr.io/owner/app:latest"
                spellCheck={false}
                value={trackingDraft.imageRef}
              />
            </FormField>

            <FormField
              error={
                trackingSubmitAttempted || trackingDraft.githubRepo
                  ? trackingRepoError ?? undefined
                  : undefined
              }
              htmlFor={`image-tracking-repo-${appId}`}
              label={t("GitHub repository")}
            >
              <input
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                className="fg-input"
                disabled={trackingInputsDisabled}
                id={`image-tracking-repo-${appId}`}
                onBlur={() => {
                  const normalized = normalizeGitHubRepoInput(
                    trackingDraft.githubRepo,
                  );

                  if (normalized) {
                    updateTrackingDraft({ githubRepo: normalized });
                  }
                }}
                onChange={(event) =>
                  updateTrackingDraft({ githubRepo: event.target.value })
                }
                placeholder="owner/repo"
                spellCheck={false}
                value={trackingDraft.githubRepo}
              />
            </FormField>

            <FormField
              htmlFor={`image-tracking-workflow-${appId}`}
              label={t("Workflow")}
              optionalLabel={t("Optional")}
            >
              <input
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                className="fg-input"
                disabled={trackingInputsDisabled}
                id={`image-tracking-workflow-${appId}`}
                onChange={(event) =>
                  updateTrackingDraft({ githubWorkflow: event.target.value })
                }
                placeholder="deploy.yml"
                spellCheck={false}
                value={trackingDraft.githubWorkflow}
              />
            </FormField>

            <FormField
              htmlFor={`image-tracking-package-${appId}`}
              label={t("Package")}
              optionalLabel={t("Optional")}
            >
              <input
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                className="fg-input"
                disabled={trackingInputsDisabled}
                id={`image-tracking-package-${appId}`}
                onChange={(event) =>
                  updateTrackingDraft({ githubPackage: event.target.value })
                }
                placeholder="container/package"
                spellCheck={false}
                value={trackingDraft.githubPackage}
              />
            </FormField>

            <FormField
              htmlFor={`image-tracking-installation-${appId}`}
              label={t("Installation ID")}
              optionalLabel={t("Optional")}
            >
              <input
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                className="fg-input"
                disabled={trackingInputsDisabled}
                id={`image-tracking-installation-${appId}`}
                inputMode="numeric"
                onChange={(event) =>
                  updateTrackingDraft({
                    githubInstallationId: event.target.value,
                  })
                }
                placeholder="12345678"
                spellCheck={false}
                value={trackingDraft.githubInstallationId}
              />
            </FormField>

            <label className="fg-app-images__tracking-toggle">
              <input
                checked={trackingDraft.enabled}
                disabled={trackingInputsDisabled}
                onChange={(event) =>
                  updateTrackingDraft({ enabled: event.target.checked })
                }
                type="checkbox"
              />
              <span>
                <strong>{t("Enabled")}</strong>
                <small>{t("Webhook-triggered checks are active.")}</small>
              </span>
            </label>
          </div>

          {tracking || githubLink ? (
            <dl className="fg-app-images__tracking-meta">
              {githubLink?.githubRepo ? (
                <div>
                  <dt>{t("Repository")}</dt>
                  <dd title={githubLink.githubRepo}>{githubLink.githubRepo}</dd>
                </div>
              ) : null}
              {tracking?.lastSeenDigest ? (
                <div>
                  <dt>{t("Last seen digest")}</dt>
                  <dd title={tracking.lastSeenDigest}>
                    {shortHash(tracking.lastSeenDigest, 18)}
                  </dd>
                </div>
              ) : null}
              {tracking?.lastTriggeredAt ? (
                <div>
                  <dt>{t("Last trigger")}</dt>
                  <dd title={formatExact(tracking.lastTriggeredAt)}>
                    {formatRelative(tracking.lastTriggeredAt)}
                  </dd>
                </div>
              ) : tracking?.lastCheckedAt ? (
                <div>
                  <dt>{t("Last check")}</dt>
                  <dd title={formatExact(tracking.lastCheckedAt)}>
                    {formatRelative(tracking.lastCheckedAt)}
                  </dd>
                </div>
              ) : null}
              {tracking?.lastError ? (
                <div>
                  <dt>{t("Last error")}</dt>
                  <dd title={tracking.lastError}>{tracking.lastError}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <div className="fg-app-images__tracking-actions">
            <Button
              disabled={!canSaveTracking}
              loading={trackingSaving}
              loadingLabel={t("Saving…")}
              size="compact"
              type="submit"
              variant="primary"
            >
              {trackingResponse?.tracking
                ? t("Update binding")
                : t("Bind repository")}
            </Button>
            <Button
              disabled={!canSyncTracking}
              loading={trackingSyncing}
              loadingLabel={t("Checking…")}
              onClick={() => {
                void handleTrackingSyncNow();
              }}
              size="compact"
              type="button"
              variant="secondary"
            >
              {t("Sync now")}
            </Button>
          </div>
        </form>
      </section>
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

      {renderTrackingPanel()}

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
