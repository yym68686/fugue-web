"use client";

import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";

import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { useI18n } from "@/components/providers/i18n-provider";
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

type Translator = ReturnType<typeof useI18n>["t"];
type NumberFormatter = ReturnType<typeof useI18n>["formatNumber"];
type RelativeTimeFormatter = ReturnType<typeof useI18n>["formatRelativeTime"];
type DateTimeFormatter = ReturnType<typeof useI18n>["formatDateTime"];

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

function readErrorMessage(error: unknown, t: Translator) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return t("Request failed.");
}

async function readResponseError(response: Response, t: Translator) {
  const body = await response.text().catch(() => "");
  const trimmed = body.trim();

  if (!trimmed) {
    return t("Request failed with status {status}.", {
      status: response.status,
    });
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

async function requestJson<T>(
  input: RequestInfo,
  init: RequestInit | undefined,
  t: Translator,
) {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(await readResponseError(response, t));
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

function formatCompactNumber(
  value: number,
  formatNumber: NumberFormatter,
  digits = 1,
) {
  return formatNumber(value, {
    maximumFractionDigits: digits,
    minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(1, digits),
  });
}

function formatCurrencyFromMicroCents(
  value: number,
  currency: string,
  locale: string,
) {
  return new Intl.NumberFormat(locale, {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value / MICRO_CENTS_PER_DOLLAR);
}

function formatHourlyCurrencyFromMicroCents(
  value: number,
  currency: string,
  locale: string,
) {
  const amount = value / MICRO_CENTS_PER_DOLLAR;

  if (amount === 0 || Math.abs(amount) >= 0.01) {
    return formatCurrencyFromMicroCents(value, currency, locale);
  }

  return new Intl.NumberFormat(locale, {
    currency,
    maximumSignificantDigits: 3,
    minimumSignificantDigits: 1,
    style: "currency",
  }).format(amount);
}

function formatSignedCurrencyFromMicroCents(
  value: number,
  currency: string,
  locale: string,
) {
  return new Intl.NumberFormat(locale, {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    signDisplay: "always",
    style: "currency",
  }).format(value / MICRO_CENTS_PER_DOLLAR);
}

function formatCPU(cpuMillicores: number, formatNumber: NumberFormatter) {
  const cores = cpuMillicores / MILLICORES_PER_VCPU;

  if (cpuMillicores === 0) {
    return "0 CPU";
  }

  const digits = Number.isInteger(cores) ? 0 : cores >= 10 ? 1 : 2;
  return `${formatCompactNumber(cores, formatNumber, digits)} CPU`;
}

function formatMemoryMebibytes(
  memoryMebibytes: number,
  formatNumber: NumberFormatter,
) {
  const gib = memoryMebibytes / MEBIBYTES_PER_GIB;
  return `${formatCompactNumber(gib, formatNumber, Number.isInteger(gib) ? 0 : 2)} GiB`;
}

function formatStorageGibibytes(
  storageGibibytes: number,
  formatNumber: NumberFormatter,
) {
  return `${formatCompactNumber(
    storageGibibytes,
    formatNumber,
    Number.isInteger(storageGibibytes) ? 0 : 2,
  )} GiB`;
}

function readNonNegativeMetric(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function formatCurrentUsageSpec(
  usage: FugueResourceUsage | null,
  imageStorageBytes: number | null,
  formatNumber: NumberFormatter,
  t: Translator,
) {
  const imageBytes = readNonNegativeMetric(imageStorageBytes);

  if (!usage) {
    if (imageBytes <= 0) {
      return t("No live stats");
    }

    return formatResourceSpec({
      cpuMillicores: 0,
      memoryMebibytes: 0,
      storageGibibytes: imageBytes / BYTES_PER_GIBIBYTE,
    }, formatNumber);
  }

  return formatResourceSpec({
    cpuMillicores: readNonNegativeMetric(usage.cpuMillicores),
    memoryMebibytes: readNonNegativeMetric(usage.memoryBytes) / BYTES_PER_MEBIBYTE,
    storageGibibytes:
      (readNonNegativeMetric(usage.ephemeralStorageBytes) + imageBytes) /
      BYTES_PER_GIBIBYTE,
  }, formatNumber);
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

function readBillingSyncToast(syncError: string | null, t: Translator) {
  if (syncError) {
    return t("Billing snapshot refreshed with partial live data.");
  }

  return t("Billing snapshot refreshed.");
}

function readBillingSyncAlert(syncError: string, t: Translator) {
  return (
    syncError ||
    t(
      "Some billing details could not be refreshed. Visible values may be incomplete.",
    )
  );
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

function formatResourceSpec(
  spec: FugueResourceSpec,
  formatNumber: NumberFormatter,
) {
  const parts = [
    formatCPU(spec.cpuMillicores, formatNumber),
    formatMemoryMebibytes(spec.memoryMebibytes, formatNumber),
  ];

  if (spec.storageGibibytes !== undefined) {
    parts.push(formatStorageGibibytes(spec.storageGibibytes, formatNumber));
  }

  return parts.join(" / ");
}

function formatRelativeTime(
  value: string | null | undefined,
  formatRelativeTimeValue: RelativeTimeFormatter,
  t: Translator,
) {
  return formatRelativeTimeValue(value, {
    justNowText: t("Just now"),
    notYetText: t("Not yet"),
  });
}

function formatExactTime(
  value: string | null | undefined,
  formatDateTime: DateTimeFormatter,
  t: Translator,
) {
  const timestamp = parseTimestamp(value);

  if (!timestamp) {
    return t("Not yet");
  }

  return formatDateTime(timestamp, {
    emptyText: t("Not yet"),
    formatOptions: {
      dateStyle: "medium",
      timeStyle: "short",
    },
  });
}

function formatRunwayDurationHours(
  value: number | null | undefined,
  formatNumber: NumberFormatter,
  t: Translator,
) {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) {
    return null;
  }

  if (value < 1) {
    return t("<1 hour");
  }

  if (value < 24) {
    return t(value === 1 ? "{count} hour" : "{count} hours", {
      count: formatCompactNumber(value, formatNumber, value < 10 ? 1 : 0),
    });
  }

  const days = value / 24;

  if (days < 14) {
    return t(days === 1 ? "{count} day" : "{count} days", {
      count: formatCompactNumber(days, formatNumber, days < 10 ? 1 : 0),
    });
  }

  if (days < 60) {
    return t("{count} weeks", {
      count: formatCompactNumber(days / 7, formatNumber, 1),
    });
  }

  return t("{count} months", {
    count: formatCompactNumber(days / 30, formatNumber, 1),
  });
}

function readRunwayLabel(
  billing: FugueBillingSummary,
  formatNumber: NumberFormatter,
  t: Translator,
) {
  if (billing.hourlyRateMicroCents <= 0 || billing.status === "inactive") {
    return t("Paused");
  }

  if (billing.balanceMicroCents <= 0) {
    return t("Top up now");
  }

  return (
    formatRunwayDurationHours(billing.runwayHours, formatNumber, t) ??
    t("No live estimate")
  );
}

function readRunwaySupportCopy(
  billing: FugueBillingSummary,
  formatNumber: NumberFormatter,
  t: Translator,
) {
  if (billing.hourlyRateMicroCents <= 0 || billing.status === "inactive") {
    return t("Credits are deducted when managed resources are active.");
  }

  if (billing.balanceMicroCents <= 0) {
    return t(
      "Add credits before you raise capacity or start new managed resources.",
    );
  }

  const duration = formatRunwayDurationHours(billing.runwayHours, formatNumber, t);
  return duration
    ? t("At the current rate, your balance lasts about {duration}.", { duration })
    : t("Runway updates after the latest live billing sync.");
}

function readTopUpHint(
  units: number | null,
  billing: FugueBillingSummary | null,
  formatNumber: NumberFormatter,
  t: Translator,
) {
  const baseMessage = t(
    "Whole USD amounts only. Min {min}, max {max}.",
    {
      max: `$${MAX_TOP_UP_UNITS}`,
      min: `$${MIN_TOP_UP_UNITS}`,
    },
  );

  if (units === null || !billing) {
    return baseMessage;
  }

  if (billing.hourlyRateMicroCents <= 0 || billing.status === "inactive") {
    return `${baseMessage} ${t(
      "Credits are deducted only while managed resources are active.",
    )}`;
  }

  const addedRunwayHours =
    (units * MICRO_CENTS_PER_DOLLAR) / billing.hourlyRateMicroCents;
  const duration = formatRunwayDurationHours(addedRunwayHours, formatNumber, t);

  if (!duration) {
    return baseMessage;
  }

  return `${baseMessage} ${t(
    "At the current rate, {amount} adds about {duration} of runway.",
    {
      amount: `$${units}`,
      duration,
    },
  )}`;
}

function readTopUpButtonLabel(units: number | null, t: Translator) {
  return units !== null
    ? t("Add {amount} credits", { amount: `$${units}` })
    : t("Add credits");
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

function humanizeStatus(value: string, t: Translator) {
  const normalized = value.trim().toLowerCase();

  switch (normalized) {
    case "active":
      return t("Active");
    case "inactive":
      return t("Inactive");
    case "restricted":
      return t("Restricted");
    case "over-cap":
      return t("Over cap");
    default:
      return value
        .replace(/[_-]+/g, " ")
        .trim()
        .replace(/\b\w/g, (match) => match.toUpperCase());
  }
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

function readCallout(billing: FugueBillingSummary, t: Translator) {
  if (billing.overCap || billing.status === "over-cap") {
    return {
      message:
        t(
          "Current usage is above your saved capacity cap. Save a higher cap to match what is already committed.",
        ),
      variant: "warning" as const,
    };
  }

  if (billing.balanceRestricted || billing.status === "restricted") {
    return {
      message:
        t(
          "Balance is empty. Add credits before you expand capacity or start new managed resources.",
        ),
      variant: "error" as const,
    };
  }

  if (billing.status === "inactive") {
    return {
      message: t(
        "Managed billing is paused. Set both CPU and memory above zero to resume.",
      ),
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

function readEventTitle(event: FugueBillingEvent, t: Translator) {
  switch (event.type) {
    case "top-up":
      return t("Balance top-up");
    case "balance-adjusted":
      return event.metadata.source === "platform-admin"
        ? t("Admin balance adjustment")
        : t("Balance adjustment");
    case "config-updated":
      return t("Envelope updated");
    default:
      return humanizeStatus(event.type, t);
  }
}

function readEventResourceSpec(
  event: FugueBillingEvent,
  formatNumber: NumberFormatter,
) {
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
  }, formatNumber);
}

function readEventDetail(
  event: FugueBillingEvent,
  currency: string,
  locale: string,
  formatNumber: NumberFormatter,
  t: Translator,
) {
  switch (event.type) {
    case "top-up": {
      const note = event.metadata.note?.trim();
      const amountLabel = formatCurrencyFromMicroCents(
        event.amountMicroCents,
        currency,
        locale,
      );

      if (note) {
        return t("Added {amount}. {note}", {
          amount: amountLabel,
          note,
        });
      }

      return t("Added {amount} to the prepaid balance.", {
        amount: amountLabel,
      });
    }
    case "config-updated": {
      const envelope = readEventResourceSpec(event, formatNumber);
      const autoExpand = event.metadata.source?.trim() === "auto-expand";

      if (!envelope) {
        return autoExpand
          ? t("Managed envelope was raised automatically.")
          : t("Managed envelope changed.");
      }

      return autoExpand
        ? t("Managed envelope automatically raised to {envelope}.", { envelope })
        : t("Managed envelope set to {envelope}.", { envelope });
    }
    case "balance-adjusted": {
      const note = event.metadata.note?.trim();
      const amountLabel =
        event.amountMicroCents === 0
          ? t("No change")
          : formatSignedCurrencyFromMicroCents(
              event.amountMicroCents,
              currency,
              locale,
            );
      const actorLabel =
        event.metadata.source?.trim() === "platform-admin"
          ? t("Platform admin adjusted the prepaid balance")
          : t("Balance adjusted");

      if (note) {
        return t("{actor} by {amount}. {note}", {
          actor: actorLabel,
          amount: amountLabel,
          note,
        });
      }

      return t("{actor} by {amount}.", {
        actor: actorLabel,
        amount: amountLabel,
      });
    }
    default:
      return t("Billing event recorded.");
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
  const { formatDateTime, formatNumber, formatRelativeTime: formatRelativeTimeValue, locale, t } =
    useI18n();
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
    locale,
  );
  const previewHourlyRateLabel = formatHourlyCurrencyFromMicroCents(
    previewHourlyRateMicroCents,
    currency,
    locale,
  );
  const availableCreditsLabel = formatCurrencyFromMicroCents(
    billing?.balanceMicroCents ?? 0,
    currency,
    locale,
  );
  const currentMonthlySpendLabel = formatCurrencyFromMicroCents(
    billing?.monthlyEstimateMicroCents ?? 0,
    currency,
    locale,
  );
  const currentHourlySpendLabel = formatHourlyCurrencyFromMicroCents(
    billing?.hourlyRateMicroCents ?? 0,
    currency,
    locale,
  );
  const currentUsageLabel = formatCurrentUsageSpec(
    billing?.currentUsage ?? null,
    imageStorageBytes,
    formatNumber,
    t,
  );
  const runwayLabel = billing
    ? readRunwayLabel(billing, formatNumber, t)
    : t("No live estimate");
  const runwaySupportCopy = billing
    ? readRunwaySupportCopy(billing, formatNumber, t)
    : t("Runway updates after live billing data is available.");
  const topUpHintText = readTopUpHint(parsedTopUpUnits, billing, formatNumber, t);
  const topUpButtonLabel = readTopUpButtonLabel(parsedTopUpUnits, t);
  const billingUpdatedLabel = billing?.updatedAt
    ? t("Updated {time}", {
        time: formatRelativeTime(billing.updatedAt, formatRelativeTimeValue, t),
      })
    : t("Billing snapshot ready");
  const capacityPreviewLabel = hasEnvelopeChanges ? t("New cap") : t("Current cap");
  const capacityPreviewCopy = hasEnvelopeChanges
    ? t("Changes apply after you save.")
    : t("Maximum managed resources for this workspace.");
  const chargedAtCopy =
    t("Charges follow the larger of your saved cap and any resources already committed.");
  const projectedSpendLabel = hasEnvelopeChanges
    ? t("New monthly spend")
    : t("Projected monthly spend");
  const projectedSpendCopy =
    previewHourlyRateMicroCents > 0
      ? t("{amount} / hour", {
          amount: previewHourlyRateLabel,
        })
      : t("Paused until both CPU and memory are above zero.");
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
    const data = await requestJson<BillingRoutePayload>(
      "/api/fugue/billing",
      {
        cache: "no-store",
      },
      t,
    );

    if (!data) {
      throw new Error(t("Empty response."));
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
        message: readBillingSyncToast(data.syncError, t),
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
        message: readErrorMessage(error, t),
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
      throw new Error(await readResponseError(response, t));
    }

    const data = (await response.json().catch(() => null)) as BillingTopupStatusPayload | null;

    if (
      !data ||
      typeof data.requestId !== "string" ||
      typeof data.status !== "string" ||
      typeof data.units !== "number" ||
      typeof data.amountCents !== "number"
    ) {
      throw new Error(t("Billing top-up status response was malformed."));
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
        setSyncError(readErrorMessage(error, t));
      });
    }

    showToast({
      message: t("Payment completed. Billing balance refreshed."),
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
      message: t("Payment failed."),
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
        t("We could not confirm payment status yet. Check again in a few seconds."),
      );
      showToast({
        message: readErrorMessage(error, t),
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
          t(
            "We could not confirm payment status automatically. Check again in a few seconds.",
          ),
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
      }>(
        "/api/fugue/billing",
        {
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
        },
        t,
      );

      if (!data?.billing) {
        throw new Error(t("Billing update response was malformed."));
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
            ? t("Managed billing paused.")
            : t("Managed envelope updated."),
        variant: "success",
      });
    } catch (error) {
      const message = readErrorMessage(error, t);
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
        t("Enter a whole USD amount between {min} and {max}.", {
          max: `$${MAX_TOP_UP_UNITS}`,
          min: `$${MIN_TOP_UP_UNITS}`,
        }),
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
        t,
      );

      if (
        !data ||
        typeof data.checkoutUrl !== "string" ||
        !data.checkoutUrl.trim() ||
        typeof data.requestId !== "string" ||
        !data.requestId.trim()
      ) {
        throw new Error(t("Billing checkout response was malformed."));
      }

      setTrackedTopUpRequestId(data.requestId.trim());
      window.location.href = data.checkoutUrl.trim();
    } catch (error) {
      const message = readErrorMessage(error, t);
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
          <p className="fg-label fg-panel__eyebrow">{t("Billing")}</p>
          <PanelTitle>{t("Unable to load tenant billing")}</PanelTitle>
          <PanelCopy>
            {workspaceName?.trim()
              ? t("Fugue could not read the billing state for {workspaceName}.", {
                  workspaceName,
                })
              : t("Fugue could not read the current tenant billing state.")}
          </PanelCopy>
        </PanelSection>

        <PanelSection className="fg-billing-retry">
          <InlineAlert variant="error">
            {syncError ?? t("Billing data is unavailable right now. Retry the request.")}
          </InlineAlert>

          <div className="fg-settings-form__actions">
            <Button
              loading={isRefreshing}
              loadingLabel={t("Refreshing…")}
              onClick={() => {
                void handleRefresh();
              }}
              type="button"
              variant="primary"
            >
              {t("Retry billing sync")}
            </Button>
          </div>
        </PanelSection>
      </Panel>
    );
  }

  const callout = readCallout(billing, t);

  return (
    <>
      {syncError ? (
        <InlineAlert variant="info">
          {readBillingSyncAlert(syncError, t)}
        </InlineAlert>
      ) : null}

      <Panel className="fg-billing-surface fg-billing-surface--health">
        <PanelSection>
          <div className="fg-billing-health__head">
            <div className="fg-billing-section-copy">
              <p className="fg-label fg-panel__eyebrow">{t("Billing health")}</p>
              <PanelTitle>{t("Keep credits and capacity in sync")}</PanelTitle>
              <PanelCopy>
                {t(
                  "Add credits to your balance, then set a capacity cap. Fugue deducts credits from active resources, and stored images count toward disk usage.",
                )}
              </PanelCopy>
            </div>

            <div className="fg-billing-health__meta">
              <div className="fg-billing-status-row">
                <StatusBadge tone={readStatusTone(billing)}>
                  {humanizeStatus(billing.status, t)}
                </StatusBadge>
                {billing.overCap ? (
                  <StatusBadge tone="warning">{t("Save higher cap")}</StatusBadge>
                ) : null}
                {billing.balanceRestricted ? (
                  <StatusBadge tone="warning">{t("Top up required")}</StatusBadge>
                ) : null}
                {billing.byoVpsFree ? (
                  <StatusBadge tone="info">{t("BYO VPS free")}</StatusBadge>
                ) : null}
              </div>

              <p className="fg-billing-health__stamp">{billingUpdatedLabel}</p>
            </div>
          </div>
        </PanelSection>

        <PanelSection>
          <ConsoleSummaryGrid
            ariaLabel={t("Billing health")}
            items={[
              { label: t("Available credits"), value: availableCreditsLabel },
              { label: t("Estimated runway"), value: runwayLabel },
              { label: t("Projected monthly spend"), value: currentMonthlySpendLabel },
              { label: t("Current usage"), value: currentUsageLabel },
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
                  <p className="fg-label fg-panel__eyebrow">{t("Capacity")}</p>
                  <PanelTitle>{t("Set your capacity cap")}</PanelTitle>
                  <PanelCopy>
                    {t(
                      "Save the maximum managed CPU, memory, and disk for this workspace. Fugue charges against the larger of your saved cap and any resources already committed.",
                    )}
                  </PanelCopy>
                </div>
              </div>

              <div className="fg-billing-signal-grid">
                <article className="fg-billing-signal-card is-primary">
                  <span>{capacityPreviewLabel}</span>
                  <strong>{formatResourceSpec(previewSpec, formatNumber)}</strong>
                  <p>{capacityPreviewCopy}</p>
                </article>

                <article className="fg-billing-signal-card">
                  <span>{t("Charged at")}</span>
                  <strong>{formatResourceSpec(previewBilledSpec, formatNumber)}</strong>
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
                  {t(
                    "Saved capacity exceeds the temporary 2 CPU / 4 GiB / 30 GiB UI cap. Save again to bring it back into range.",
                  )}
                </InlineAlert>
              ) : null}

              <form className="fg-settings-form fg-billing-form" noValidate onSubmit={handleEnvelopeSubmit}>
                <div className="fg-billing-form__grid">
                  <SteppedSliderField
                    disabled={isSavingEnvelope}
                    id="billing-envelope-cpu"
                    label={t("CPU")}
                    max={CPU_SLIDER_MAX_CORES}
                    maxLabel={formatCPU(Math.round(CPU_SLIDER_MAX_CORES * MILLICORES_PER_VCPU), formatNumber)}
                    minLabel={formatCPU(0, formatNumber)}
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
                    valueLabel={formatCPU(envelopeCpu, formatNumber)}
                  />

                  <SteppedSliderField
                    disabled={isSavingEnvelope}
                    id="billing-envelope-memory"
                    label={t("Memory")}
                    max={MEMORY_SLIDER_MAX_GIB}
                    maxLabel={formatMemoryMebibytes(Math.round(MEMORY_SLIDER_MAX_GIB * MEBIBYTES_PER_GIB), formatNumber)}
                    minLabel={formatMemoryMebibytes(0, formatNumber)}
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
                    valueLabel={formatMemoryMebibytes(envelopeMemory, formatNumber)}
                  />

                  <SteppedSliderField
                    disabled={isSavingEnvelope}
                    id="billing-envelope-storage"
                    label={t("Storage")}
                    max={STORAGE_SLIDER_MAX_GIB}
                    maxLabel={formatStorageGibibytes(STORAGE_SLIDER_MAX_GIB, formatNumber)}
                    minLabel={formatStorageGibibytes(0, formatNumber)}
                    onChange={(nextValue) => {
                      setEnvelopeStorage(clampEnvelopeStorageGibibytes(nextValue));
                      if (envelopeError) {
                        setEnvelopeError(null);
                      }
                    }}
                    step={STORAGE_STEP_GIB}
                    value={envelopeStorage}
                    valueLabel={formatStorageGibibytes(envelopeStorage, formatNumber)}
                  />
                </div>

                {envelopeError ? <InlineAlert variant="error">{envelopeError}</InlineAlert> : null}

                <div className="fg-settings-form__actions">
                  <Button
                    disabled={!hasEnvelopeChanges}
                    loading={isSavingEnvelope}
                    loadingLabel={t("Saving cap…")}
                    type="submit"
                    variant="primary"
                  >
                    {t("Save capacity cap")}
                  </Button>

                  <Button
                    disabled={isSavingEnvelope || isToppingUp}
                    loading={isRefreshing}
                    loadingLabel={t("Refreshing…")}
                    onClick={() => {
                      void handleRefresh();
                    }}
                    type="button"
                    variant="secondary"
                  >
                    {t("Refresh billing")}
                  </Button>
                </div>
              </form>
            </PanelSection>
          </Panel>

          <Panel className="fg-billing-surface fg-billing-surface--balance">
            <PanelSection>
              <div className="fg-billing-section-head">
                <div className="fg-billing-section-copy">
                  <p className="fg-label fg-panel__eyebrow">{t("Credits")}</p>
                  <PanelTitle>{t("Keep your workspace funded")}</PanelTitle>
                  <PanelCopy>
                    {t(
                      "Top up credits before you expand capacity. Credits are deducted while resources run, and stored images count toward disk usage.",
                    )}
                  </PanelCopy>
                </div>
              </div>

              <div className="fg-billing-signal-grid">
                <article className="fg-billing-signal-card is-primary">
                  <span>{t("Available credits")}</span>
                  <strong>{availableCreditsLabel}</strong>
                  <p>{t("Credits ready to cover current managed usage.")}</p>
                </article>

                <article className="fg-billing-signal-card">
                  <span>{t("Estimated runway")}</span>
                  <strong>{runwayLabel}</strong>
                  <p>{runwaySupportCopy}</p>
                </article>

                <article className="fg-billing-signal-card">
                  <span>{t("Projected monthly spend")}</span>
                  <strong>{currentMonthlySpendLabel}</strong>
                  <p>
                    {billing.hourlyRateMicroCents > 0
                      ? t("{amount} / hour at the current live rate.", {
                          amount: currentHourlySpendLabel,
                        })
                      : t("No live burn right now.")}
                  </p>
                </article>
              </div>
            </PanelSection>

            <PanelSection>
              <p className="fg-billing-top-up-note">
                {t("Need more room? Add credits here first, then raise the capacity cap.")}
              </p>

              <form
                className="fg-settings-form fg-billing-form fg-billing-top-up-form"
                onSubmit={handleTopUpSubmit}
              >
                <div className="fg-billing-top-up-form__field fg-field-stack">
                  <label className="fg-field-label" htmlFor="billing-top-up-amount">
                    <span>{t("Top-up amount")}</span>
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
                          placeholder={t("25")}
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
                          loadingLabel={t("Preparing checkout…")}
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
                    aria-label={t("Suggested top-up amounts")}
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
                <InlineAlert variant="info">
                  {t("Waiting for checkout confirmation…")}
                </InlineAlert>
              ) : null}

              {trackedTopUpRequestId && (topUpPending || topUpStatusError) ? (
                <div className="fg-billing-top-up-status">
                  <InlineAlert variant={topUpStatusError ? "error" : "info"}>
                    {topUpStatusError ??
                      t(
                        "Checkout is still being confirmed. Credits appear here automatically after payment clears.",
                      )}
                  </InlineAlert>

                  <div className="fg-billing-top-up-status__row">
                    <span className="fg-billing-top-up-status__request">{trackedTopUpRequestId}</span>
                    <Button
                      loading={checkingTopUpStatus}
                      loadingLabel={t("Checking…")}
                      onClick={() => {
                        void recheckTopUp();
                      }}
                      size="tight"
                      type="button"
                      variant="secondary"
                    >
                      {t("Check payment status")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </PanelSection>
          </Panel>
        </div>

        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">{t("History")}</p>
            <PanelTitle>{t("Billing activity")}</PanelTitle>
            <PanelCopy>
              {t("Top-ups, balance adjustments, and capacity changes appear here.")}
            </PanelCopy>
          </PanelSection>

          <PanelSection>
            {billing.events.length ? (
              <div
                className="fg-billing-ledger-table"
                role="table"
                aria-label={t("Recent billing events")}
              >
                <div className="fg-billing-ledger-table__head" role="row">
                  <span>{t("Event")}</span>
                  <span>{t("Amount")}</span>
                  <span>{t("Balance after")}</span>
                  <span>{t("Created")}</span>
                </div>

                <ul className="fg-billing-ledger-table__body">
                  {billing.events.map((event) => (
                    <li className="fg-billing-ledger-row" key={event.id} role="row">
                      <div
                        className="fg-billing-ledger-row__event"
                        data-label={t("Event")}
                        role="cell"
                      >
                        <div className="fg-billing-ledger-row__event-head">
                          <strong>{readEventTitle(event, t)}</strong>
                          <StatusBadge tone={readEventTone(event)}>
                            {formatRelativeTime(
                              event.createdAt,
                              formatRelativeTimeValue,
                              t,
                            )}
                          </StatusBadge>
                        </div>
                        <p>{readEventDetail(event, currency, locale, formatNumber, t)}</p>
                      </div>

                      <div
                        className="fg-billing-ledger-row__cell fg-billing-ledger-row__cell--amount"
                        data-label={t("Amount")}
                        data-tone={readEventTone(event)}
                        role="cell"
                      >
                        <strong>
                          {event.amountMicroCents
                            ? formatSignedCurrencyFromMicroCents(
                                event.amountMicroCents,
                                currency,
                                locale,
                              )
                            : t("No charge")}
                        </strong>
                      </div>

                      <div
                        className="fg-billing-ledger-row__cell"
                        data-label={t("Balance after")}
                        role="cell"
                      >
                        <strong>
                          {formatCurrencyFromMicroCents(
                            event.balanceAfterMicroCents,
                            currency,
                            locale,
                          )}
                        </strong>
                      </div>

                      <div
                        className="fg-billing-ledger-row__cell"
                        data-label={t("Created")}
                        role="cell"
                      >
                        <strong>{formatExactTime(event.createdAt, formatDateTime, t)}</strong>
                        <span>
                          {formatRelativeTime(
                            event.createdAt,
                            formatRelativeTimeValue,
                            t,
                          )}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <ConsoleEmptyState
                description={t(
                  "Top-ups, admin balance adjustments, and envelope changes will appear here.",
                )}
                title={t("No billing events yet")}
              />
            )}
          </PanelSection>
        </Panel>
      </section>
    </>
  );
}
