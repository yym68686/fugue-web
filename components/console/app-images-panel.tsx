"use client";

import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/console/status-badge";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useToast } from "@/components/ui/toast";
import { readGitHubCommitHref } from "@/lib/fugue/source-links";
import {
  readFugueSourceLabel,
  readFugueSourceMeta,
} from "@/lib/fugue/source-display";
import { copyText } from "@/lib/ui/clipboard";
import { cx } from "@/lib/ui/cx";

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

function formatCompactNumber(value: number, digits = 1) {
  const formatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(1, digits),
  });

  return formatter.format(value);
}

function formatBytesLabel(value?: number | null) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return "No stats";
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
    return `${rounded} ${rounded === 1 ? "byte" : "bytes"}`;
  }

  return `${formatCompactNumber(amount, digits)} ${units[unitIndex]}`;
}

function parseTimestamp(value?: string | null) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatExactTime(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  const timestamp = parseTimestamp(value);

  if (!timestamp) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function formatRelativeTime(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  const timestamp = parseTimestamp(value);

  if (!timestamp) {
    return "Unknown";
  }

  const deltaSeconds = Math.round((timestamp - Date.now()) / 1000);
  const units = [
    { amount: 60, unit: "second" as const },
    { amount: 60, unit: "minute" as const },
    { amount: 24, unit: "hour" as const },
    { amount: 7, unit: "day" as const },
    { amount: 4.34524, unit: "week" as const },
    { amount: 12, unit: "month" as const },
    { amount: Number.POSITIVE_INFINITY, unit: "year" as const },
  ];

  let valueForUnit = deltaSeconds;

  for (const { amount, unit } of units) {
    if (Math.abs(valueForUnit) < amount) {
      return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
        Math.trunc(valueForUnit),
        unit,
      );
    }

    valueForUnit /= amount;
  }

  return "Just now";
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

function shortHash(value?: string | null, length = 12) {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized.slice(0, length) : null;
}

function readVersionTitle(version: AppImageVersion) {
  const sourceLabel = readFugueSourceLabel(version.source);

  if (sourceLabel && sourceLabel !== "Unspecified source") {
    return sourceLabel;
  }

  return version.current ? "Current managed image" : "Saved managed image";
}

function readVersionSubtitle(version: AppImageVersion) {
  const details = [readFugueSourceMeta(version.source)];

  if (version.lastDeployedAt) {
    details.push(`Last deployed ${formatRelativeTime(version.lastDeployedAt)}`);
  }

  return details
    .filter((value): value is string => Boolean(value) && value !== "Unknown")
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

function readVersionStatusLabel(version: AppImageVersion) {
  if (version.current) {
    return "Current";
  }

  if (version.status === "available") {
    return "Saved";
  }

  return "Missing";
}

function readDeleteDescription(version: AppImageVersion, appName: string) {
  const details = [
    `${readVersionTitle(version)} will be removed from ${appName}'s saved image history.`,
    version.reclaimableSizeBytes > 0
      ? `Estimated reclaimable space: ${formatBytesLabel(version.reclaimableSizeBytes)}.`
      : "This version shares most of its blobs with other images, so reclaim may be limited.",
  ];

  return details.join(" ");
}

function readClearHistoryDescription(
  versions: AppImageVersion[],
  appName: string,
  reclaimableSizeBytes: number,
) {
  const parts = [
    `${versions.length} saved image version${versions.length === 1 ? "" : "s"} will be removed from ${appName}.`,
    reclaimableSizeBytes > 0
      ? `Estimated reclaimable space: ${formatBytesLabel(reclaimableSizeBytes)}.`
      : "These versions share most of their blobs with other images, so reclaim may be limited.",
  ];

  return parts.join(" ");
}

function buildClearHistoryToast(
  deletedCount: number,
  alreadyMissingCount: number,
  failedCount: number,
  reclaimedSizeBytes: number,
) {
  const parts = [];

  if (deletedCount > 0) {
    parts.push(
      `Deleted ${deletedCount} saved image version${deletedCount === 1 ? "" : "s"}.`,
    );
  }

  if (alreadyMissingCount > 0) {
    parts.push(
      `${alreadyMissingCount} version${alreadyMissingCount === 1 ? "" : "s"} were already missing.`,
    );
  }

  if (reclaimedSizeBytes > 0) {
    parts.push(`Estimated reclaim: ${formatBytesLabel(reclaimedSizeBytes)}.`);
  }

  if (failedCount > 0) {
    parts.push(
      `Failed to remove ${failedCount} version${failedCount === 1 ? "" : "s"}.`,
    );
  }

  return {
    message: parts.join(" ") || "Saved image history updated.",
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

export function AppImagesPanel({
  appId,
  appName,
  onRequestRefreshWindow,
}: AppImagesPanelProps) {
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

    requestJson<AppImageInventoryResponse>(`/api/fugue/apps/${appId}/images`, {
      cache: "no-store",
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
          message: readErrorMessage(error),
          variant: "error",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [appId, refreshToken, showToast]);

  const currentVersions =
    inventory?.versions.filter((version) => version.current) ?? [];
  const historicalVersions =
    inventory?.versions.filter((version) => !version.current) ?? [];
  const clearableVersions = historicalVersions.filter(
    (version) => version.deleteSupported,
  );
  const clearHistoryKey = "clear-history";

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
        message: `${label} copied.`,
        variant: "success",
      });
    } catch {
      showToast({
        message: `Unable to copy ${label.toLowerCase()}.`,
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
          ? "Historical image queued for deploy."
          : "Historical image selected for deploy.",
        variant: "success",
      });
      onRequestRefreshWindow?.(90_000);
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
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
      confirmLabel: "Delete image",
      description: readDeleteDescription(version, appName),
      title: "Delete saved image?",
    });

    if (!confirmed) {
      return;
    }

    setBusyKey(actionKey);

    try {
      const response = await deleteVersion(version);

      const reclaimedSizeBytes = response?.reclaimedSizeBytes ?? 0;
      const detail =
        reclaimedSizeBytes > 0
          ? ` Estimated reclaim: ${formatBytesLabel(reclaimedSizeBytes)}.`
          : "";

      if (response?.deleted || response?.alreadyMissing) {
        removeVersionsFromInventory([version.imageRef]);
      }

      showToast({
        message: response?.alreadyMissing
          ? `Saved image was already missing.${detail}`
          : `Saved image deleted.${detail}`,
        variant: "success",
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
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
      confirmLabel: "Clear history",
      description: readClearHistoryDescription(
        clearableVersions,
        appName,
        inventory?.summary.reclaimableSizeBytes ?? 0,
      ),
      title: "Delete all saved images?",
    });

    if (!confirmed) {
      return;
    }

    setBusyKey(clearHistoryKey);

    let deletedCount = 0;
    let alreadyMissingCount = 0;
    let failedCount = 0;
    const removedImageRefs: string[] = [];
    let reclaimedSizeBytes = 0;

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
          reclaimedSizeBytes += response.reclaimedSizeBytes ?? 0;
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
        reclaimedSizeBytes,
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
                {readVersionStatusLabel(version)}
              </StatusBadge>
              {version.source?.commitSha ? (
                <span className="fg-app-images__chip">
                  Commit {shortHash(version.source.commitSha)}
                </span>
              ) : null}
              {version.source?.uploadFilename ? (
                <span className="fg-app-images__chip">
                  {version.source.uploadFilename}
                </span>
              ) : null}
            </div>
            <strong className="fg-app-images__card-title">
              {readVersionTitle(version)}
            </strong>
            <p className="fg-app-images__card-meta">
              {readVersionSubtitle(version)}
            </p>
          </div>

          <div className="fg-app-images__card-actions">
            <Button
              onClick={() => {
                void handleCopy(version.imageRef, "Image reference");
              }}
              size="compact"
              type="button"
              variant="ghost"
            >
              Copy ref
            </Button>
            {!version.current && version.redeploySupported ? (
              <Button
                disabled={actionDisabled && busyKey !== redeployKey}
                loading={busyKey === redeployKey}
                loadingLabel="Queueing…"
                onClick={() => {
                  void handleRedeploy(version);
                }}
                size="compact"
                type="button"
                variant="secondary"
              >
                Redeploy
              </Button>
            ) : null}
            {!version.current && version.deleteSupported ? (
              <Button
                disabled={actionDisabled && busyKey !== deleteKey}
                loading={busyKey === deleteKey}
                loadingLabel="Deleting…"
                onClick={() => {
                  void handleDelete(version);
                }}
                size="compact"
                type="button"
                variant="danger"
              >
                Delete
              </Button>
            ) : null}
          </div>
        </div>

        <dl className="fg-app-images__details">
          <div>
            <dt>Image ref</dt>
            <dd className="fg-app-images__mono" title={version.imageRef}>
              {version.imageRef}
            </dd>
          </div>
          {runtimeImageRef ? (
            <div>
              <dt>Runtime ref</dt>
              <dd className="fg-app-images__mono" title={runtimeImageRef}>
                {runtimeImageRef}
              </dd>
            </div>
          ) : null}
          {version.digest ? (
            <div>
              <dt>Digest</dt>
              <dd className="fg-app-images__mono" title={version.digest}>
                {version.digest}
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Stored size</dt>
            <dd>{formatBytesLabel(version.sizeBytes)}</dd>
          </div>
          {!version.current ? (
            <div>
              <dt>Reclaimable</dt>
              <dd>{formatBytesLabel(version.reclaimableSizeBytes)}</dd>
            </div>
          ) : null}
          {version.lastDeployedAt ? (
            <div>
              <dt>Last deployed</dt>
              <dd title={formatExactTime(version.lastDeployedAt)}>
                {formatRelativeTime(version.lastDeployedAt)}
              </dd>
            </div>
          ) : null}
          {commitHref ? (
            <div>
              <dt>Commit</dt>
              <dd>
                <a
                  className="fg-app-images__link"
                  href={commitHref}
                  rel="noreferrer"
                  target="_blank"
                >
                  {shortHash(version.source?.commitSha) ?? "Open commit"}
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
          <p className="fg-label fg-panel__eyebrow">Images</p>
          <p className="fg-console-note">
            Review the current managed image and older saved versions for{" "}
            {appName}. Image storage is tracked separately from live service
            disk usage here, and stale versions can be redeployed or removed.
          </p>
        </div>

        <div className="fg-workbench-section__actions">
          <Button
            disabled={status === "loading" || refreshing || Boolean(busyKey)}
            loading={refreshing}
            loadingLabel="Refreshing…"
            onClick={() => {
              setRefreshToken((value) => value + 1);
            }}
            size="compact"
            type="button"
            variant="secondary"
          >
            Refresh now
          </Button>
          {inventory?.registryConfigured && clearableVersions.length > 0 ? (
            <Button
              disabled={Boolean(busyKey && busyKey !== clearHistoryKey)}
              loading={busyKey === clearHistoryKey}
              loadingLabel="Clearing…"
              onClick={() => {
                void handleClearHistory();
              }}
              size="compact"
              type="button"
              variant="danger"
            >
              Clear history
            </Button>
          ) : null}
        </div>
      </div>

      {status === "loading" && !inventory ? (
        <p className="fg-console-note">Loading saved images…</p>
      ) : null}

      {status === "error" ? (
        <InlineAlert variant="error">
          Unable to load saved images right now. Try refreshing this panel.
        </InlineAlert>
      ) : null}

      {status === "ready" && inventory ? (
        <>
          {!inventory.registryConfigured ? (
            <InlineAlert variant="info">
              Internal registry inventory is not configured for this workspace
              yet.
            </InlineAlert>
          ) : null}

          {inventory.registryConfigured ? (
            <div className="fg-app-images__summary-grid">
              <article className="fg-app-images__summary-card">
                <span>Total image storage</span>
                <strong>
                  {formatBytesLabel(inventory.summary.totalSizeBytes)}
                </strong>
                <p>
                  {inventory.summary.versionCount} version
                  {inventory.summary.versionCount === 1 ? "" : "s"}
                </p>
              </article>
              <article className="fg-app-images__summary-card">
                <span>Current release</span>
                <strong>
                  {formatBytesLabel(inventory.summary.currentSizeBytes)}
                </strong>
                <p>
                  {inventory.summary.currentVersionCount} active version
                  {inventory.summary.currentVersionCount === 1 ? "" : "s"}
                </p>
              </article>
              <article className="fg-app-images__summary-card">
                <span>Saved history</span>
                <strong>
                  {formatBytesLabel(inventory.summary.staleSizeBytes)}
                </strong>
                <p>
                  {inventory.summary.staleVersionCount} old version
                  {inventory.summary.staleVersionCount === 1 ? "" : "s"}
                </p>
              </article>
              <article className="fg-app-images__summary-card">
                <span>Reclaimable</span>
                <strong>
                  {formatBytesLabel(inventory.summary.reclaimableSizeBytes)}
                </strong>
                <p>After stale image cleanup</p>
              </article>
            </div>
          ) : null}

          {inventory.registryConfigured ? (
            inventory.summary.versionCount === 0 ? (
              <div className="fg-app-images__empty">
                <strong>No managed image history yet.</strong>
                <p>
                  Historical versions appear here after the app has been
                  imported or redeployed through Fugue.
                </p>
              </div>
            ) : (
              <div className="fg-app-images__sections">
                {currentVersions.length ? (
                  <section className="fg-app-images__section">
                    <div className="fg-app-images__section-head">
                      <div>
                        <p className="fg-label fg-panel__eyebrow">
                          Current release
                        </p>
                        <p className="fg-console-note">
                          The image version that currently represents this app.
                        </p>
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
                      <p className="fg-label fg-panel__eyebrow">
                        Saved history
                      </p>
                      <p className="fg-console-note">
                        Redeploy a known-good version, or delete stale images
                        you no longer need.
                      </p>
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
                      <strong>No stale images to clean up.</strong>
                      <p>Only the current managed image is stored right now.</p>
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
