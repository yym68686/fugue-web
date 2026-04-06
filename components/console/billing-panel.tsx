"use client";

import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";

import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import {
  CONSOLE_BILLING_PAGE_SNAPSHOT_URL,
  type ConsoleBillingPageSnapshot,
  readConsolePageSnapshot,
  writeConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";
import { ConsoleSummaryGrid } from "@/components/console/console-summary-grid";
import { StatusBadge } from "@/components/console/status-badge";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import {
  clampSteppedValue,
  SteppedSliderField,
} from "@/components/ui/stepped-slider-field";
import { useToast } from "@/components/ui/toast";
import type {
  FugueBillingEvent,
  FugueBillingPriceBook,
  FugueBillingSummary,
  FugueResourceSpec,
  FugueResourceUsage,
} from "@/lib/fugue/api";
import type { ConsoleTone } from "@/lib/console/types";

type BillingRoutePayload = {
  billing: FugueBillingSummary | null;
  imageStorageBytes: number | null;
  syncError: string | null;
  workspace: {
    tenantId: string;
    tenantName: string;
  };
};

type BillingTopupCheckoutPayload = {
  checkoutUrl: string;
  requestId: string;
};

type BillingTopupStatusPayload = {
  amountCents: number;
  requestId: string;
  status: string;
  units: number;
};

function syncBillingPageSnapshot(nextData: BillingRoutePayload) {
  const currentSnapshot = readConsolePageSnapshot<ConsoleBillingPageSnapshot>(
    CONSOLE_BILLING_PAGE_SNAPSHOT_URL,
    {
      allowStale: true,
    },
  );

  writeConsolePageSnapshot<ConsoleBillingPageSnapshot>(
    CONSOLE_BILLING_PAGE_SNAPSHOT_URL,
    {
      data:
        currentSnapshot?.state === "ready"
          ? {
              ...currentSnapshot.data,
              ...nextData,
            }
          : nextData,
      state: "ready",
    },
  );
}

function readBillingSnapshotWorkspace(fallbackWorkspaceName?: string | null) {
  const currentSnapshot = readConsolePageSnapshot<ConsoleBillingPageSnapshot>(
    CONSOLE_BILLING_PAGE_SNAPSHOT_URL,
    {
      allowStale: true,
    },
  );

  if (currentSnapshot?.state === "ready") {
    return currentSnapshot.data.workspace;
  }

  return {
    tenantId: "",
    tenantName: fallbackWorkspaceName ?? "",
  };
}

const MICRO_CENTS_PER_DOLLAR = 100_000_000;
const MILLICORES_PER_VCPU = 1000;
const MEBIBYTES_PER_GIB = 1024;
const BYTES_PER_MEBIBYTE = 1024 * 1024;
const BYTES_PER_GIBIBYTE = BYTES_PER_MEBIBYTE * MEBIBYTES_PER_GIB;
const CPU_STEP_CORES = 0.5;
const MEMORY_STEP_GIB = 0.25;
const STORAGE_STEP_GIB = 1;
const CPU_SLIDER_MAX_CORES = 2;
const MEMORY_SLIDER_MAX_GIB = 4;
const STORAGE_SLIDER_MAX_GIB = 30;
const CPU_SLIDER_MAX_MILLICORES = CPU_SLIDER_MAX_CORES * MILLICORES_PER_VCPU;
const MEMORY_SLIDER_MAX_MEBIBYTES = MEMORY_SLIDER_MAX_GIB * MEBIBYTES_PER_GIB;
const BILLING_TOP_UP_PRESET_AMOUNTS = [10, 25, 50, 100];
const MIN_TOP_UP_UNITS = 5;
const MAX_TOP_UP_UNITS = 5000;

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

function parseTimestamp(value?: string | null) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCompactNumber(value: number, digits = 1) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(1, digits),
  }).format(value);
}

function formatCurrencyFromMicroCents(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value / MICRO_CENTS_PER_DOLLAR);
}

function formatHourlyCurrencyFromMicroCents(value: number, currency: string) {
  const amount = value / MICRO_CENTS_PER_DOLLAR;

  if (amount === 0 || Math.abs(amount) >= 0.01) {
    return formatCurrencyFromMicroCents(value, currency);
  }

  return new Intl.NumberFormat("en-US", {
    currency,
    maximumSignificantDigits: 3,
    minimumSignificantDigits: 1,
    style: "currency",
  }).format(amount);
}

function formatSignedCurrencyFromMicroCents(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    signDisplay: "always",
    style: "currency",
  }).format(value / MICRO_CENTS_PER_DOLLAR);
}

function formatCPU(cpuMillicores: number) {
  const cores = cpuMillicores / MILLICORES_PER_VCPU;

  if (cpuMillicores === 0) {
    return "0 cpu";
  }

  const digits = Number.isInteger(cores) ? 0 : cores >= 10 ? 1 : 2;
  return `${formatCompactNumber(cores, digits)} cpu`;
}

function formatMemoryMebibytes(memoryMebibytes: number) {
  const gib = memoryMebibytes / MEBIBYTES_PER_GIB;
  return `${formatCompactNumber(gib, Number.isInteger(gib) ? 0 : 2)} GiB`;
}

function formatStorageGibibytes(storageGibibytes: number) {
  return `${formatCompactNumber(storageGibibytes, Number.isInteger(storageGibibytes) ? 0 : 2)} GiB`;
}

function readNonNegativeMetric(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function formatCurrentUsageSpec(
  usage: FugueResourceUsage | null,
  imageStorageBytes: number | null,
) {
  const imageBytes = readNonNegativeMetric(imageStorageBytes);

  if (!usage) {
    if (imageBytes <= 0) {
      return "No live stats";
    }

    return formatResourceSpec({
      cpuMillicores: 0,
      memoryMebibytes: 0,
      storageGibibytes: imageBytes / BYTES_PER_GIBIBYTE,
    });
  }

  return formatResourceSpec({
    cpuMillicores: readNonNegativeMetric(usage.cpuMillicores),
    memoryMebibytes: readNonNegativeMetric(usage.memoryBytes) / BYTES_PER_MEBIBYTE,
    storageGibibytes:
      (readNonNegativeMetric(usage.ephemeralStorageBytes) + imageBytes) /
      BYTES_PER_GIBIBYTE,
  });
}

function readRetainedImageStorageBytes(
  nextValue: number | null,
  currentValue: number | null,
  syncError: string | null,
) {
  if (nextValue === null && syncError) {
    return currentValue;
  }

  return nextValue;
}

function readBillingSyncToast(syncError: string | null) {
  if (syncError) {
    return "Billing snapshot refreshed with partial live data.";
  }

  return "Billing snapshot refreshed.";
}

function readBillingSyncAlert(syncError: string) {
  return syncError || "Some billing details could not be refreshed. Visible values may be incomplete.";
}

function clampEnvelopeCpuMillicores(value: number) {
  return Math.round(
    clampSteppedValue({
      max: CPU_SLIDER_MAX_CORES,
      step: CPU_STEP_CORES,
      value: value / MILLICORES_PER_VCPU,
    }) * MILLICORES_PER_VCPU,
  );
}

function clampEnvelopeMemoryMebibytes(value: number) {
  return Math.round(
    clampSteppedValue({
      max: MEMORY_SLIDER_MAX_GIB,
      step: MEMORY_STEP_GIB,
      value: value / MEBIBYTES_PER_GIB,
    }) * MEBIBYTES_PER_GIB,
  );
}

function clampEnvelopeStorageGibibytes(value: number) {
  return Math.round(
    clampSteppedValue({
      max: STORAGE_SLIDER_MAX_GIB,
      step: STORAGE_STEP_GIB,
      value,
    }),
  );
}

function formatResourceSpec(spec: FugueResourceSpec) {
  const parts = [
    formatCPU(spec.cpuMillicores),
    formatMemoryMebibytes(spec.memoryMebibytes),
  ];

  if (spec.storageGibibytes !== undefined) {
    parts.push(formatStorageGibibytes(spec.storageGibibytes));
  }

  return parts.join(" / ");
}

function formatRelativeTime(value?: string | null) {
  const timestamp = parseTimestamp(value);

  if (!timestamp) {
    return "Not yet";
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

function formatExactTime(value?: string | null) {
  const timestamp = parseTimestamp(value);

  if (!timestamp) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function formatRunwayDurationHours(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) {
    return null;
  }

  if (value < 1) {
    return "<1 hour";
  }

  if (value < 24) {
    return `${formatCompactNumber(value, value < 10 ? 1 : 0)} hours`;
  }

  const days = value / 24;

  if (days < 14) {
    return `${formatCompactNumber(days, days < 10 ? 1 : 0)} days`;
  }

  if (days < 60) {
    return `${formatCompactNumber(days / 7, 1)} weeks`;
  }

  return `${formatCompactNumber(days / 30, 1)} months`;
}

function readRunwayLabel(billing: FugueBillingSummary) {
  if (billing.hourlyRateMicroCents <= 0 || billing.status === "inactive") {
    return "Paused";
  }

  if (billing.balanceMicroCents <= 0) {
    return "Top up now";
  }

  return formatRunwayDurationHours(billing.runwayHours) ?? "No live estimate";
}

function readRunwaySupportCopy(billing: FugueBillingSummary) {
  if (billing.hourlyRateMicroCents <= 0 || billing.status === "inactive") {
    return "Credits are deducted when managed resources are active.";
  }

  if (billing.balanceMicroCents <= 0) {
    return "Add credits before you raise capacity or start new managed resources.";
  }

  const duration = formatRunwayDurationHours(billing.runwayHours);
  return duration
    ? `At the current rate, your balance lasts about ${duration}.`
    : "Runway updates after the latest live billing sync.";
}

function readTopUpHint(
  units: number | null,
  billing: FugueBillingSummary | null,
) {
  const baseMessage = `Whole USD amounts only. Min $${MIN_TOP_UP_UNITS}, max $${MAX_TOP_UP_UNITS}.`;

  if (units === null || !billing) {
    return baseMessage;
  }

  if (billing.hourlyRateMicroCents <= 0 || billing.status === "inactive") {
    return `${baseMessage} Credits are deducted only while managed resources are active.`;
  }

  const addedRunwayHours =
    (units * MICRO_CENTS_PER_DOLLAR) / billing.hourlyRateMicroCents;
  const duration = formatRunwayDurationHours(addedRunwayHours);

  if (!duration) {
    return baseMessage;
  }

  return `${baseMessage} At the current rate, $${units} adds about ${duration} of runway.`;
}

function readTopUpButtonLabel(units: number | null) {
  return units !== null ? `Add $${units} credits` : "Add credits";
}

function parseDollarUnits(value: string) {
  const trimmed = value.trim();

  if (!trimmed || !/^\d+$/.test(trimmed)) {
    return null;
  }

  const wholeDollars = Number(trimmed);

  if (!Number.isSafeInteger(wholeDollars)) {
    return null;
  }

  return wholeDollars;
}

function clearTopUpQueryParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete("request_id");
  url.searchParams.delete("requestId");

  if (url.toString() === window.location.href) {
    return;
  }

  window.history.replaceState(null, "", url.toString());
}

function waitMs(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(() => {
      resolve();
    }, ms);

    if (!signal) {
      return;
    }

    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}

function humanizeStatus(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function readStatusTone(billing: FugueBillingSummary): ConsoleTone {
  if (billing.overCap || billing.status === "over-cap") {
    return "warning";
  }

  if (billing.balanceRestricted || billing.status === "restricted") {
    return "warning";
  }

  if (billing.status === "active") {
    return "positive";
  }

  return "neutral";
}

function readCallout(billing: FugueBillingSummary) {
  if (billing.overCap || billing.status === "over-cap") {
    return {
      message:
        "Current usage is above your saved capacity cap. Save a higher cap to match what is already committed.",
      variant: "warning" as const,
    };
  }

  if (billing.balanceRestricted || billing.status === "restricted") {
    return {
      message:
        "Balance is empty. Add credits before you expand capacity or start new managed resources.",
      variant: "error" as const,
    };
  }

  if (billing.status === "inactive") {
    return {
      message: "Managed billing is paused. Set both CPU and memory above zero to resume.",
      variant: "info" as const,
    };
  }

  return null;
}

function estimateHourlyRateMicroCents(
  spec: FugueResourceSpec,
  priceBook: FugueBillingPriceBook,
  committedStorageGibibytes = 0,
) {
  if (spec.cpuMillicores <= 0 || spec.memoryMebibytes <= 0) {
    return 0;
  }

  return (
    spec.cpuMillicores * priceBook.cpuMicroCentsPerMillicoreHour +
    spec.memoryMebibytes * priceBook.memoryMicroCentsPerMibHour +
    Math.max(spec.storageGibibytes ?? 0, committedStorageGibibytes) *
      priceBook.storageMicroCentsPerGibHour
  );
}

function estimateMonthlyMicroCents(
  spec: FugueResourceSpec,
  priceBook: FugueBillingPriceBook,
  committedStorageGibibytes = 0,
) {
  return (
    estimateHourlyRateMicroCents(spec, priceBook, committedStorageGibibytes) *
    priceBook.hoursPerMonth
  );
}

function readEventTone(event: FugueBillingEvent): ConsoleTone {
  switch (event.type) {
    case "top-up":
      return "positive";
    case "balance-adjusted":
      if (event.amountMicroCents > 0) {
        return "positive";
      }
      if (event.amountMicroCents < 0) {
        return "warning";
      }
      return "neutral";
    case "config-updated":
      return "info";
    default:
      return "neutral";
  }
}

function readEventTitle(event: FugueBillingEvent) {
  switch (event.type) {
    case "top-up":
      return "Balance top-up";
    case "balance-adjusted":
      return event.metadata.source === "platform-admin"
        ? "Admin balance adjustment"
        : "Balance adjustment";
    case "config-updated":
      return "Envelope updated";
    default:
      return humanizeStatus(event.type);
  }
}

function readEventResourceSpec(event: FugueBillingEvent) {
  const cpuMillicores = Number(event.metadata.cpu_millicores);
  const memoryMebibytes = Number(event.metadata.memory_mebibytes);
  const storageGibibytes = Number(event.metadata.storage_gibibytes);

  if (!Number.isFinite(cpuMillicores) || !Number.isFinite(memoryMebibytes)) {
    return null;
  }

  return formatResourceSpec({
    cpuMillicores,
    memoryMebibytes,
    ...(Number.isFinite(storageGibibytes) ? { storageGibibytes } : {}),
  });
}

function readEventDetail(event: FugueBillingEvent, currency: string) {
  switch (event.type) {
    case "top-up": {
      const note = event.metadata.note?.trim();

      if (note) {
        return `Added ${formatCurrencyFromMicroCents(event.amountMicroCents, currency)}. ${note}`;
      }

      return `Added ${formatCurrencyFromMicroCents(event.amountMicroCents, currency)} to the prepaid balance.`;
    }
    case "config-updated": {
      const envelope = readEventResourceSpec(event);
      const autoExpand = event.metadata.source?.trim() === "auto-expand";

      if (!envelope) {
        return autoExpand ? "Managed envelope was raised automatically." : "Managed envelope changed.";
      }

      return autoExpand
        ? `Managed envelope automatically raised to ${envelope}.`
        : `Managed envelope set to ${envelope}.`;
    }
    case "balance-adjusted": {
      const note = event.metadata.note?.trim();
      const amountLabel =
        event.amountMicroCents === 0
          ? "no change"
          : formatSignedCurrencyFromMicroCents(event.amountMicroCents, currency);
      const actorLabel =
        event.metadata.source?.trim() === "platform-admin"
          ? "Platform admin adjusted the prepaid balance"
          : "Balance adjusted";

      if (note) {
        return `${actorLabel} by ${amountLabel}. ${note}`;
      }

      return `${actorLabel} by ${amountLabel}.`;
    }
    default:
      return "Billing event recorded.";
  }
}

export function BillingPanel({
  initialBilling,
  initialImageStorageBytes,
  initialSyncError,
  workspaceName,
}: {
  initialBilling: FugueBillingSummary | null;
  initialImageStorageBytes: number | null;
  initialSyncError: string | null;
  workspaceName?: string | null;
}) {
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [billing, setBilling] = useState(initialBilling);
  const [imageStorageBytes, setImageStorageBytes] = useState(initialImageStorageBytes);
  const [syncError, setSyncError] = useState(initialSyncError);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [envelopeCpu, setEnvelopeCpu] = useState(
    clampEnvelopeCpuMillicores(initialBilling?.managedCap.cpuMillicores ?? 0),
  );
  const [envelopeMemory, setEnvelopeMemory] = useState(
    clampEnvelopeMemoryMebibytes(initialBilling?.managedCap.memoryMebibytes ?? 0),
  );
  const [envelopeStorage, setEnvelopeStorage] = useState(
    clampEnvelopeStorageGibibytes(initialBilling?.managedCap.storageGibibytes ?? 0),
  );
  const [topUpAmount, setTopUpAmount] = useState("");
  const [envelopeError, setEnvelopeError] = useState<string | null>(null);
  const [topUpError, setTopUpError] = useState<string | null>(null);
  const [topUpStatusError, setTopUpStatusError] = useState<string | null>(null);
  const [topUpPending, setTopUpPending] = useState(false);
  const [topUpBlocking, setTopUpBlocking] = useState(false);
  const [checkingTopUpStatus, setCheckingTopUpStatus] = useState(false);
  const [trackedTopUpRequestId, setTrackedTopUpRequestId] = useState<string | null>(null);

  useEffect(() => {
    setBilling(initialBilling);
    setImageStorageBytes(initialImageStorageBytes);
    setSyncError(initialSyncError);
    setEnvelopeCpu(clampEnvelopeCpuMillicores(initialBilling?.managedCap.cpuMillicores ?? 0));
    setEnvelopeMemory(
      clampEnvelopeMemoryMebibytes(initialBilling?.managedCap.memoryMebibytes ?? 0),
    );
    setEnvelopeStorage(
      clampEnvelopeStorageGibibytes(initialBilling?.managedCap.storageGibibytes ?? 0),
    );
    setEnvelopeError(null);
    setTopUpStatusError(null);
  }, [initialBilling, initialImageStorageBytes, initialSyncError]);

  const isRefreshing = busyAction === "refresh";
  const isSavingEnvelope = busyAction === "save-envelope";
  const isToppingUp = busyAction === "top-up";
  const currency = billing?.priceBook.currency ?? "USD";
  const envelopeCpuCores = envelopeCpu / MILLICORES_PER_VCPU;
  const envelopeMemoryGib = envelopeMemory / MEBIBYTES_PER_GIB;
  const committedStorageGibibytes = billing?.managedCommitted.storageGibibytes ?? 0;
  const parsedTopUpUnits = parseDollarUnits(topUpAmount);
  const topUpAmountHintId = "billing-top-up-amount-hint";
  const topUpAmountErrorId = "billing-top-up-amount-error";
  const topUpRequestIdFromUrl = (() => {
    const rawValue = searchParams.get("request_id") ?? searchParams.get("requestId");
    return rawValue?.trim() ? rawValue.trim() : null;
  })();
  const hasUnresolvedTopUp =
    topUpBlocking || topUpPending || Boolean(topUpStatusError?.trim());
  const previewSpec: FugueResourceSpec = {
    cpuMillicores: envelopeCpu,
    memoryMebibytes: envelopeMemory,
    storageGibibytes: envelopeStorage,
  };
  const previewBilledSpec: FugueResourceSpec = {
    ...previewSpec,
    storageGibibytes:
      envelopeCpu > 0 && envelopeMemory > 0
        ? Math.max(envelopeStorage, committedStorageGibibytes)
        : 0,
  };
  const hasEnvelopeChanges =
    billing !== null &&
    (envelopeCpu !== billing.managedCap.cpuMillicores ||
      envelopeMemory !== billing.managedCap.memoryMebibytes ||
      envelopeStorage !== billing.managedCap.storageGibibytes);
  const previewHourlyRateMicroCents =
    billing !== null
      ? estimateHourlyRateMicroCents(previewSpec, billing.priceBook, committedStorageGibibytes)
      : 0;
  const previewMonthlyEstimateMicroCents =
    billing !== null
      ? estimateMonthlyMicroCents(previewSpec, billing.priceBook, committedStorageGibibytes)
      : 0;
  const previewMonthlyEstimateLabel = formatCurrencyFromMicroCents(
    previewMonthlyEstimateMicroCents,
    currency,
  );
  const previewHourlyRateLabel = formatHourlyCurrencyFromMicroCents(
    previewHourlyRateMicroCents,
    currency,
  );
  const availableCreditsLabel = formatCurrencyFromMicroCents(
    billing?.balanceMicroCents ?? 0,
    currency,
  );
  const currentMonthlySpendLabel = formatCurrencyFromMicroCents(
    billing?.monthlyEstimateMicroCents ?? 0,
    currency,
  );
  const currentHourlySpendLabel = formatHourlyCurrencyFromMicroCents(
    billing?.hourlyRateMicroCents ?? 0,
    currency,
  );
  const currentUsageLabel = formatCurrentUsageSpec(
    billing?.currentUsage ?? null,
    imageStorageBytes,
  );
  const runwayLabel = billing ? readRunwayLabel(billing) : "No live estimate";
  const runwaySupportCopy = billing
    ? readRunwaySupportCopy(billing)
    : "Runway updates after live billing data is available.";
  const topUpHintText = readTopUpHint(parsedTopUpUnits, billing);
  const topUpButtonLabel = readTopUpButtonLabel(parsedTopUpUnits);
  const billingUpdatedLabel = billing?.updatedAt
    ? `Updated ${formatRelativeTime(billing.updatedAt)}`
    : "Billing snapshot ready";
  const capacityPreviewLabel = hasEnvelopeChanges ? "New cap" : "Current cap";
  const capacityPreviewCopy = hasEnvelopeChanges
    ? "Changes apply after you save."
    : "Maximum managed resources for this workspace.";
  const chargedAtCopy =
    "Charges follow the larger of your saved cap and any resources already committed.";
  const projectedSpendLabel = hasEnvelopeChanges
    ? "New monthly spend"
    : "Projected monthly spend";
  const projectedSpendCopy =
    previewHourlyRateMicroCents > 0
      ? `${previewHourlyRateLabel} / hour`
      : "Paused until both CPU and memory are above zero.";
  const envelopeExceedsUiCap =
    billing !== null &&
    (billing.managedCap.cpuMillicores > CPU_SLIDER_MAX_MILLICORES ||
      billing.managedCap.memoryMebibytes > MEMORY_SLIDER_MAX_MEBIBYTES ||
      billing.managedCap.storageGibibytes > STORAGE_SLIDER_MAX_GIB);

  function applyBillingSnapshot(nextBilling: FugueBillingSummary) {
    setBilling(nextBilling);
    setEnvelopeCpu(clampEnvelopeCpuMillicores(nextBilling.managedCap.cpuMillicores));
    setEnvelopeMemory(clampEnvelopeMemoryMebibytes(nextBilling.managedCap.memoryMebibytes));
    setEnvelopeStorage(clampEnvelopeStorageGibibytes(nextBilling.managedCap.storageGibibytes));
    setEnvelopeError(null);
  }

  async function refreshBilling(options?: { quiet?: boolean }) {
    const data = await requestJson<BillingRoutePayload>("/api/fugue/billing", {
      cache: "no-store",
    });

    if (!data) {
      throw new Error("Empty response.");
    }

    syncBillingPageSnapshot(data);

    startTransition(() => {
      setSyncError(data.syncError);
      setImageStorageBytes((currentValue) =>
        readRetainedImageStorageBytes(
          data.imageStorageBytes,
          currentValue,
          data.syncError,
        ),
      );

      if (data.billing) {
        applyBillingSnapshot(data.billing);
      }
    });

    if (!options?.quiet) {
      showToast({
        message: readBillingSyncToast(data.syncError),
        variant: data.syncError ? "info" : "success",
      });
    }

    return data;
  }

  async function handleRefresh() {
    if (busyAction) {
      return;
    }

    setBusyAction("refresh");

    try {
      await refreshBilling();
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function fetchTopUpStatus(
    requestId: string,
    signal?: AbortSignal,
  ) {
    const response = await fetch(
      `/api/fugue/billing/top-ups/status?request_id=${encodeURIComponent(requestId)}`,
      {
        cache: "no-store",
        signal,
      },
    );

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }

    const data = (await response.json().catch(() => null)) as BillingTopupStatusPayload | null;

    if (
      !data ||
      typeof data.requestId !== "string" ||
      typeof data.status !== "string" ||
      typeof data.units !== "number" ||
      typeof data.amountCents !== "number"
    ) {
      throw new Error("Billing top-up status response was malformed.");
    }

    return data;
  }

  async function handleTopUpCompleted() {
    clearTopUpQueryParams();

    startTransition(() => {
      setTopUpBlocking(false);
      setTopUpPending(false);
      setTopUpError(null);
      setTopUpStatusError(null);
      setTopUpAmount("");
    });

    try {
      await refreshBilling({ quiet: true });
    } catch (error) {
      startTransition(() => {
        setSyncError(readErrorMessage(error));
      });
    }

    showToast({
      message: "Payment completed. Billing balance refreshed.",
      variant: "success",
    });
  }

  async function handleTopUpFailed() {
    clearTopUpQueryParams();

    startTransition(() => {
      setTopUpBlocking(false);
      setTopUpPending(false);
      setTopUpStatusError(null);
    });

    showToast({
      message: "Payment failed.",
      variant: "error",
    });
  }

  async function recheckTopUp() {
    if (!trackedTopUpRequestId || checkingTopUpStatus) {
      return;
    }

    const startedAt = Date.now();
    setCheckingTopUpStatus(true);
    setTopUpStatusError(null);

    try {
      const status = await fetchTopUpStatus(trackedTopUpRequestId);

      if (status.status === "completed") {
        await handleTopUpCompleted();
      } else if (status.status === "failed") {
        await handleTopUpFailed();
      } else {
        setTopUpPending(true);
        setTopUpStatusError(null);
      }
    } catch (error) {
      setTopUpStatusError(
        "We could not confirm payment status yet. Check again in a few seconds.",
      );
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed < 700) {
        await waitMs(700 - elapsed);
      }
      setCheckingTopUpStatus(false);
    }
  }

  useEffect(() => {
    if (!topUpRequestIdFromUrl) {
      return;
    }

    setTrackedTopUpRequestId(topUpRequestIdFromUrl);
    setTopUpPending(false);
    setTopUpBlocking(true);
    setTopUpError(null);
    setTopUpStatusError(null);

    const controller = new AbortController();
    let cancelled = false;
    let statusCheckFailed = false;

    void (async () => {
      const deadline = Date.now() + 10_000;

      while (!cancelled && Date.now() < deadline) {
        try {
          const status = await fetchTopUpStatus(topUpRequestIdFromUrl, controller.signal);

          if (cancelled) {
            return;
          }

          if (status.status === "completed") {
            await handleTopUpCompleted();
            return;
          }

          if (status.status === "failed") {
            await handleTopUpFailed();
            return;
          }
        } catch {
          statusCheckFailed = true;
          break;
        }

        await waitMs(1200, controller.signal);
      }

      if (cancelled) {
        return;
      }

      setTopUpBlocking(false);
      setTopUpPending(true);

      if (statusCheckFailed) {
        setTopUpStatusError(
          "We could not confirm payment status automatically. Check again in a few seconds.",
        );
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [topUpRequestIdFromUrl]);

  async function handleEnvelopeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busyAction || !billing) {
      return;
    }

    setBusyAction("save-envelope");
    setEnvelopeError(null);

    try {
      const data = await requestJson<{
        billing: FugueBillingSummary;
      }>("/api/fugue/billing", {
        body: JSON.stringify({
          managedCap: {
            cpuMillicores: envelopeCpu,
            memoryMebibytes: envelopeMemory,
            storageGibibytes: envelopeStorage,
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      if (!data?.billing) {
        throw new Error("Billing update response was malformed.");
      }

      syncBillingPageSnapshot({
        billing: data.billing,
        imageStorageBytes,
        syncError: null,
        workspace: readBillingSnapshotWorkspace(workspaceName),
      });

      startTransition(() => {
        setSyncError(null);
        applyBillingSnapshot(data.billing);
      });

      showToast({
        message:
          envelopeCpu === 0 || envelopeMemory === 0
            ? "Managed billing paused."
            : "Managed envelope updated.",
        variant: "success",
      });
    } catch (error) {
      const message = readErrorMessage(error);
      setEnvelopeError(message);
      showToast({
        message,
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleTopUpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busyAction || hasUnresolvedTopUp) {
      return;
    }

    if (
      parsedTopUpUnits === null ||
      parsedTopUpUnits < MIN_TOP_UP_UNITS ||
      parsedTopUpUnits > MAX_TOP_UP_UNITS
    ) {
      setTopUpError(
        `Enter a whole USD amount between $${MIN_TOP_UP_UNITS} and $${MAX_TOP_UP_UNITS}.`,
      );
      return;
    }

    setBusyAction("top-up");
    setTopUpError(null);
    setTopUpStatusError(null);
    setTopUpPending(false);

    try {
      const data = await requestJson<BillingTopupCheckoutPayload>(
        "/api/fugue/billing/top-ups/checkout",
        {
          body: JSON.stringify({
            amountUsd: parsedTopUpUnits,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      if (
        !data ||
        typeof data.checkoutUrl !== "string" ||
        !data.checkoutUrl.trim() ||
        typeof data.requestId !== "string" ||
        !data.requestId.trim()
      ) {
        throw new Error("Billing checkout response was malformed.");
      }

      setTrackedTopUpRequestId(data.requestId.trim());
      window.location.href = data.checkoutUrl.trim();
    } catch (error) {
      const message = readErrorMessage(error);
      setTopUpError(message);
      showToast({
        message,
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  if (!billing) {
    return (
      <Panel>
        <PanelSection>
          <p className="fg-label fg-panel__eyebrow">Billing</p>
          <PanelTitle>Unable to load tenant billing</PanelTitle>
          <PanelCopy>
            {workspaceName?.trim()
              ? `Fugue could not read the billing state for ${workspaceName}.`
              : "Fugue could not read the current tenant billing state."}
          </PanelCopy>
        </PanelSection>

        <PanelSection className="fg-billing-retry">
          <InlineAlert variant="error">
            {syncError ?? "Billing data is unavailable right now. Retry the request."}
          </InlineAlert>

          <div className="fg-settings-form__actions">
            <Button
              loading={isRefreshing}
              loadingLabel="Refreshing…"
              onClick={() => {
                void handleRefresh();
              }}
              type="button"
              variant="primary"
            >
              Retry billing sync
            </Button>
          </div>
        </PanelSection>
      </Panel>
    );
  }

  const callout = readCallout(billing);

  return (
    <>
      {syncError ? (
        <InlineAlert variant="info">
          {readBillingSyncAlert(syncError)}
        </InlineAlert>
      ) : null}

      <Panel className="fg-billing-surface fg-billing-surface--health">
        <PanelSection>
          <div className="fg-billing-health__head">
            <div className="fg-billing-section-copy">
              <p className="fg-label fg-panel__eyebrow">Billing health</p>
              <PanelTitle>Keep credits and capacity in sync</PanelTitle>
              <PanelCopy>
                Add credits to your balance, then set a capacity cap. Fugue deducts credits
                from active resources, and stored images count toward disk usage.
              </PanelCopy>
            </div>

            <div className="fg-billing-health__meta">
              <div className="fg-billing-status-row">
                <StatusBadge tone={readStatusTone(billing)}>{humanizeStatus(billing.status)}</StatusBadge>
                {billing.overCap ? <StatusBadge tone="warning">Save higher cap</StatusBadge> : null}
                {billing.balanceRestricted ? (
                  <StatusBadge tone="warning">Top up required</StatusBadge>
                ) : null}
                {billing.byoVpsFree ? <StatusBadge tone="info">BYO VPS free</StatusBadge> : null}
              </div>

              <p className="fg-billing-health__stamp">{billingUpdatedLabel}</p>
            </div>
          </div>
        </PanelSection>

        <PanelSection>
          <ConsoleSummaryGrid
            ariaLabel="Billing health"
            items={[
              { label: "Available credits", value: availableCreditsLabel },
              { label: "Estimated runway", value: runwayLabel },
              { label: "Projected monthly spend", value: currentMonthlySpendLabel },
              { label: "Current usage", value: currentUsageLabel },
            ]}
          />
        </PanelSection>
      </Panel>

      <section className="fg-billing-stack">
        <div className="fg-console-two-up fg-billing-workbench">
          <Panel className="fg-billing-surface fg-billing-surface--envelope">
            <PanelSection>
              <div className="fg-billing-section-head">
                <div className="fg-billing-section-copy">
                  <p className="fg-label fg-panel__eyebrow">Capacity</p>
                  <PanelTitle>Set your capacity cap</PanelTitle>
                  <PanelCopy>
                    Save the maximum managed CPU, memory, and disk for this workspace.
                    Fugue charges against the larger of your saved cap and any resources
                    already committed.
                  </PanelCopy>
                </div>
              </div>

              <div className="fg-billing-signal-grid">
                <article className="fg-billing-signal-card is-primary">
                  <span>{capacityPreviewLabel}</span>
                  <strong>{formatResourceSpec(previewSpec)}</strong>
                  <p>{capacityPreviewCopy}</p>
                </article>

                <article className="fg-billing-signal-card">
                  <span>Charged at</span>
                  <strong>{formatResourceSpec(previewBilledSpec)}</strong>
                  <p>{chargedAtCopy}</p>
                </article>

                <article className="fg-billing-signal-card">
                  <span>{projectedSpendLabel}</span>
                  <strong>{previewMonthlyEstimateLabel}</strong>
                  <p>{projectedSpendCopy}</p>
                </article>
              </div>
            </PanelSection>

            <PanelSection>
              {callout ? <InlineAlert variant={callout.variant}>{callout.message}</InlineAlert> : null}
              {envelopeExceedsUiCap ? (
                <InlineAlert variant="warning">
                  Saved capacity exceeds the temporary 2 cpu / 4 GiB / 30 GiB UI cap.
                  Save again to bring it back into range.
                </InlineAlert>
              ) : null}

              <form className="fg-settings-form fg-billing-form" noValidate onSubmit={handleEnvelopeSubmit}>
                <div className="fg-billing-form__grid">
                  <SteppedSliderField
                    disabled={isSavingEnvelope}
                    id="billing-envelope-cpu"
                    label="CPU"
                    max={CPU_SLIDER_MAX_CORES}
                    maxLabel={formatCPU(Math.round(CPU_SLIDER_MAX_CORES * MILLICORES_PER_VCPU))}
                    minLabel={formatCPU(0)}
                    onChange={(nextValue) => {
                      setEnvelopeCpu(
                        clampEnvelopeCpuMillicores(nextValue * MILLICORES_PER_VCPU),
                      );
                      if (envelopeError) {
                        setEnvelopeError(null);
                      }
                    }}
                    step={CPU_STEP_CORES}
                    value={envelopeCpuCores}
                    valueLabel={formatCPU(envelopeCpu)}
                  />

                  <SteppedSliderField
                    disabled={isSavingEnvelope}
                    id="billing-envelope-memory"
                    label="Memory"
                    max={MEMORY_SLIDER_MAX_GIB}
                    maxLabel={formatMemoryMebibytes(Math.round(MEMORY_SLIDER_MAX_GIB * MEBIBYTES_PER_GIB))}
                    minLabel={formatMemoryMebibytes(0)}
                    onChange={(nextValue) => {
                      setEnvelopeMemory(
                        clampEnvelopeMemoryMebibytes(nextValue * MEBIBYTES_PER_GIB),
                      );
                      if (envelopeError) {
                        setEnvelopeError(null);
                      }
                    }}
                    step={MEMORY_STEP_GIB}
                    value={envelopeMemoryGib}
                    valueLabel={formatMemoryMebibytes(envelopeMemory)}
                  />

                  <SteppedSliderField
                    disabled={isSavingEnvelope}
                    id="billing-envelope-storage"
                    label="Storage"
                    max={STORAGE_SLIDER_MAX_GIB}
                    maxLabel={formatStorageGibibytes(STORAGE_SLIDER_MAX_GIB)}
                    minLabel={formatStorageGibibytes(0)}
                    onChange={(nextValue) => {
                      setEnvelopeStorage(clampEnvelopeStorageGibibytes(nextValue));
                      if (envelopeError) {
                        setEnvelopeError(null);
                      }
                    }}
                    step={STORAGE_STEP_GIB}
                    value={envelopeStorage}
                    valueLabel={formatStorageGibibytes(envelopeStorage)}
                  />
                </div>

                {envelopeError ? <InlineAlert variant="error">{envelopeError}</InlineAlert> : null}

                <div className="fg-settings-form__actions">
                  <Button
                    disabled={!hasEnvelopeChanges}
                    loading={isSavingEnvelope}
                    loadingLabel="Saving cap…"
                    type="submit"
                    variant="primary"
                  >
                    Save capacity cap
                  </Button>

                  <Button
                    disabled={isSavingEnvelope || isToppingUp}
                    loading={isRefreshing}
                    loadingLabel="Refreshing…"
                    onClick={() => {
                      void handleRefresh();
                    }}
                    type="button"
                    variant="secondary"
                  >
                    Refresh billing
                  </Button>
                </div>
              </form>
            </PanelSection>
          </Panel>

          <Panel className="fg-billing-surface fg-billing-surface--balance">
            <PanelSection>
              <div className="fg-billing-section-head">
                <div className="fg-billing-section-copy">
                  <p className="fg-label fg-panel__eyebrow">Credits</p>
                  <PanelTitle>Keep your workspace funded</PanelTitle>
                  <PanelCopy>
                    Top up credits before you expand capacity. Credits are deducted
                    while resources run, and stored images count toward disk usage.
                  </PanelCopy>
                </div>
              </div>

              <div className="fg-billing-signal-grid">
                <article className="fg-billing-signal-card is-primary">
                  <span>Available credits</span>
                  <strong>{availableCreditsLabel}</strong>
                  <p>Credits ready to cover current managed usage.</p>
                </article>

                <article className="fg-billing-signal-card">
                  <span>Estimated runway</span>
                  <strong>{runwayLabel}</strong>
                  <p>{runwaySupportCopy}</p>
                </article>

                <article className="fg-billing-signal-card">
                  <span>Projected monthly spend</span>
                  <strong>{currentMonthlySpendLabel}</strong>
                  <p>
                    {billing.hourlyRateMicroCents > 0
                      ? `${currentHourlySpendLabel} / hour at the current live rate.`
                      : "No live burn right now."}
                  </p>
                </article>
              </div>
            </PanelSection>

            <PanelSection>
              <p className="fg-billing-top-up-note">
                Need more room? Add credits here first, then raise the capacity cap.
              </p>

              <form
                className="fg-settings-form fg-billing-form fg-billing-top-up-form"
                onSubmit={handleTopUpSubmit}
              >
                <div className="fg-billing-top-up-form__field fg-field-stack">
                  <label className="fg-field-label" htmlFor="billing-top-up-amount">
                    <span>Top-up amount</span>
                  </label>

                  <div
                    className={`fg-field-control fg-billing-top-up-form__control${
                      topUpError ? " is-invalid" : ""
                    }`}
                  >
                    <div className="fg-billing-top-up-form__entry">
                      <div className="fg-billing-top-up-form__input-wrap">
                        <input
                          className="fg-input"
                          autoComplete="off"
                          aria-describedby={topUpError ? topUpAmountErrorId : topUpAmountHintId}
                          aria-invalid={topUpError ? true : undefined}
                          id="billing-top-up-amount"
                          inputMode="numeric"
                          min={MIN_TOP_UP_UNITS}
                          name="amountUsd"
                          onChange={(event) => {
                            setTopUpAmount(event.target.value);
                            if (topUpError) {
                              setTopUpError(null);
                            }
                          }}
                          placeholder="25"
                          step="1"
                          type="number"
                          value={topUpAmount}
                        />
                      </div>

                      <div className="fg-settings-form__actions fg-billing-top-up-form__actions">
                        <Button
                          disabled={
                            parsedTopUpUnits === null ||
                            parsedTopUpUnits < MIN_TOP_UP_UNITS ||
                            parsedTopUpUnits > MAX_TOP_UP_UNITS ||
                            hasUnresolvedTopUp
                          }
                          loading={isToppingUp}
                          loadingLabel="Preparing checkout…"
                          type="submit"
                          variant="primary"
                        >
                          {topUpButtonLabel}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {topUpError ? (
                    <span className="fg-field-error" id={topUpAmountErrorId}>
                      {topUpError}
                    </span>
                  ) : (
                    <span className="fg-field-hint" id={topUpAmountHintId}>
                      {topUpHintText}
                    </span>
                  )}
                </div>

                <div className="fg-billing-top-up-form__footer">
                  <div
                    className="fg-billing-top-up-presets"
                    role="group"
                    aria-label="Suggested top-up amounts"
                  >
                    {BILLING_TOP_UP_PRESET_AMOUNTS.map((amount) => (
                      <Button
                        key={amount}
                        disabled={isToppingUp || hasUnresolvedTopUp}
                        onClick={() => {
                          setTopUpAmount(String(amount));
                          if (topUpError) {
                            setTopUpError(null);
                          }
                        }}
                        size="tight"
                        type="button"
                        variant="secondary"
                      >
                        ${amount}
                      </Button>
                    ))}
                  </div>
                </div>
              </form>

              {topUpBlocking ? (
                <InlineAlert variant="info">Waiting for checkout confirmation…</InlineAlert>
              ) : null}

              {trackedTopUpRequestId && (topUpPending || topUpStatusError) ? (
                <div className="fg-billing-top-up-status">
                  <InlineAlert variant={topUpStatusError ? "error" : "info"}>
                    {topUpStatusError ??
                      "Checkout is still being confirmed. Credits appear here automatically after payment clears."}
                  </InlineAlert>

                  <div className="fg-billing-top-up-status__row">
                    <span className="fg-billing-top-up-status__request">{trackedTopUpRequestId}</span>
                    <Button
                      loading={checkingTopUpStatus}
                      loadingLabel="Checking…"
                      onClick={() => {
                        void recheckTopUp();
                      }}
                      size="tight"
                      type="button"
                      variant="secondary"
                    >
                      Check payment status
                    </Button>
                  </div>
                </div>
              ) : null}
            </PanelSection>
          </Panel>
        </div>

        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">History</p>
            <PanelTitle>Billing activity</PanelTitle>
            <PanelCopy>Top-ups, balance adjustments, and capacity changes appear here.</PanelCopy>
          </PanelSection>

          <PanelSection>
            {billing.events.length ? (
              <div className="fg-billing-ledger-table" role="table" aria-label="Recent billing events">
                <div className="fg-billing-ledger-table__head" role="row">
                  <span>Event</span>
                  <span>Amount</span>
                  <span>Balance after</span>
                  <span>Created</span>
                </div>

                <ul className="fg-billing-ledger-table__body">
                  {billing.events.map((event) => (
                    <li className="fg-billing-ledger-row" key={event.id} role="row">
                      <div className="fg-billing-ledger-row__event" data-label="Event" role="cell">
                        <div className="fg-billing-ledger-row__event-head">
                          <strong>{readEventTitle(event)}</strong>
                          <StatusBadge tone={readEventTone(event)}>{formatRelativeTime(event.createdAt)}</StatusBadge>
                        </div>
                        <p>{readEventDetail(event, currency)}</p>
                      </div>

                      <div
                        className="fg-billing-ledger-row__cell fg-billing-ledger-row__cell--amount"
                        data-label="Amount"
                        data-tone={readEventTone(event)}
                        role="cell"
                      >
                        <strong>
                          {event.amountMicroCents
                            ? formatSignedCurrencyFromMicroCents(event.amountMicroCents, currency)
                            : "No charge"}
                        </strong>
                      </div>

                      <div className="fg-billing-ledger-row__cell" data-label="Balance after" role="cell">
                        <strong>{formatCurrencyFromMicroCents(event.balanceAfterMicroCents, currency)}</strong>
                      </div>

                      <div className="fg-billing-ledger-row__cell" data-label="Created" role="cell">
                        <strong>{formatExactTime(event.createdAt)}</strong>
                        <span>{formatRelativeTime(event.createdAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <ConsoleEmptyState
                description="Top-ups, admin balance adjustments, and envelope changes will appear here."
                title="No billing events yet"
              />
            )}
          </PanelSection>
        </Panel>
      </section>
    </>
  );
}
