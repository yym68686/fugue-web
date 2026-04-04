"use client";

import { startTransition, useEffect, useState, type FormEvent } from "react";

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
import { FormField } from "@/components/ui/form-field";
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
} from "@/lib/fugue/api";
import type { ConsoleTone } from "@/lib/console/types";

type BillingRoutePayload = {
  billing: FugueBillingSummary | null;
  syncError: string | null;
  workspace: {
    tenantId: string;
    tenantName: string;
  };
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
const CPU_STEP_CORES = 0.5;
const MEMORY_STEP_GIB = 0.25;
const STORAGE_STEP_GIB = 1;
const CPU_SLIDER_MAX_CORES = 2;
const MEMORY_SLIDER_MAX_GIB = 4;
const STORAGE_SLIDER_MAX_GIB = 30;
const CPU_SLIDER_MAX_MILLICORES = CPU_SLIDER_MAX_CORES * MILLICORES_PER_VCPU;
const MEMORY_SLIDER_MAX_MEBIBYTES = MEMORY_SLIDER_MAX_GIB * MEBIBYTES_PER_GIB;
const DEFAULT_FREE_TIER_CAP: FugueResourceSpec = {
  cpuMillicores: 500,
  memoryMebibytes: 512,
  storageGibibytes: 5,
};

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

function parseDollarAmountToCents(value: string) {
  const trimmed = value.trim();

  if (!trimmed || !/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }

  const [whole, fraction = ""] = trimmed.split(".");
  const wholeDollars = Number(whole);

  if (!Number.isSafeInteger(wholeDollars)) {
    return null;
  }

  return wholeDollars * 100 + Number(`${fraction}00`.slice(0, 2));
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
      message: "Live commitment is above the saved envelope. Save a higher cap to match it.",
      variant: "warning" as const,
    };
  }

  if (billing.balanceRestricted || billing.status === "restricted") {
    return {
      message: "Balance is empty. Top up to allow new managed capacity.",
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

function sumVisibleFundingMicroCents(events: FugueBillingEvent[]) {
  return events.reduce((total, event) => {
    if (
      event.type !== "top-up" &&
      event.type !== "balance-adjusted"
    ) {
      return total;
    }

    return total + event.amountMicroCents;
  }, 0);
}

function estimateConsumedMicroCents(billing: FugueBillingSummary) {
  const seededCreditMicroCents = estimateMonthlyMicroCents(
    DEFAULT_FREE_TIER_CAP,
    billing.priceBook,
  );
  const loadedCreditMicroCents =
    seededCreditMicroCents + sumVisibleFundingMicroCents(billing.events);

  return Math.max(0, loadedCreditMicroCents - billing.balanceMicroCents);
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
  initialSyncError,
  workspaceName,
}: {
  initialBilling: FugueBillingSummary | null;
  initialSyncError: string | null;
  workspaceName?: string | null;
}) {
  const { showToast } = useToast();
  const [billing, setBilling] = useState(initialBilling);
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

  useEffect(() => {
    setBilling(initialBilling);
    setSyncError(initialSyncError);
    setEnvelopeCpu(clampEnvelopeCpuMillicores(initialBilling?.managedCap.cpuMillicores ?? 0));
    setEnvelopeMemory(
      clampEnvelopeMemoryMebibytes(initialBilling?.managedCap.memoryMebibytes ?? 0),
    );
    setEnvelopeStorage(
      clampEnvelopeStorageGibibytes(initialBilling?.managedCap.storageGibibytes ?? 0),
    );
    setEnvelopeError(null);
  }, [initialBilling, initialSyncError]);

  const isRefreshing = busyAction === "refresh";
  const isSavingEnvelope = busyAction === "save-envelope";
  const isToppingUp = busyAction === "top-up";
  const currency = billing?.priceBook.currency ?? "USD";
  const envelopeCpuCores = envelopeCpu / MILLICORES_PER_VCPU;
  const envelopeMemoryGib = envelopeMemory / MEBIBYTES_PER_GIB;
  const committedStorageGibibytes = billing?.managedCommitted.storageGibibytes ?? 0;
  const parsedTopUpCents = parseDollarAmountToCents(topUpAmount);
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
  const consumedMicroCents = billing !== null ? estimateConsumedMicroCents(billing) : 0;
  const consumedLabel = formatCurrencyFromMicroCents(consumedMicroCents, currency);
  const previewHeadroom: FugueResourceSpec = {
    cpuMillicores: Math.max(envelopeCpu - (billing?.managedCommitted.cpuMillicores ?? 0), 0),
    memoryMebibytes: Math.max(
      envelopeMemory - (billing?.managedCommitted.memoryMebibytes ?? 0),
      0,
    ),
    storageGibibytes: Math.max(envelopeStorage - committedStorageGibibytes, 0),
  };
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

      if (data.billing) {
        applyBillingSnapshot(data.billing);
      }
    });

    if (!options?.quiet) {
      showToast({
        message: data.syncError
          ? "Live billing sync failed. The last visible billing snapshot remains on screen."
          : "Billing snapshot refreshed.",
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

    if (busyAction) {
      return;
    }

    if (parsedTopUpCents === null || parsedTopUpCents <= 0) {
      setTopUpError("Enter a positive USD amount with up to two decimal places.");
      return;
    }

    setBusyAction("top-up");
    setTopUpError(null);

    try {
      const data = await requestJson<{
        billing: FugueBillingSummary;
      }>("/api/fugue/billing/top-ups", {
        body: JSON.stringify({
          amountCents: parsedTopUpCents,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!data?.billing) {
        throw new Error("Billing top-up response was malformed.");
      }

      syncBillingPageSnapshot({
        billing: data.billing,
        syncError: null,
        workspace: readBillingSnapshotWorkspace(workspaceName),
      });

      startTransition(() => {
        setSyncError(null);
        applyBillingSnapshot(data.billing);
        setTopUpAmount("");
        setTopUpError(null);
      });

      showToast({
        message: "Balance added.",
        variant: "success",
      });
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
          Live billing sync failed. The last visible billing snapshot remains on screen.
        </InlineAlert>
      ) : null}

      <ConsoleSummaryGrid
        ariaLabel="Billing summary"
        items={[
          { label: "Envelope", value: formatResourceSpec(billing.managedCap) },
          { label: "Live commitment", value: formatResourceSpec(billing.managedCommitted) },
          {
            label: "Balance",
            value: formatCurrencyFromMicroCents(billing.balanceMicroCents, currency),
          },
          { label: "Consumed", value: consumedLabel },
        ]}
      />

      <section className="fg-billing-stack">
        <Panel className="fg-billing-surface fg-billing-surface--envelope">
          <PanelSection>
            <div className="fg-billing-hero">
              <div className="fg-billing-hero__copy">
                <p className="fg-label fg-panel__eyebrow">Managed envelope</p>
                <div className="fg-billing-hero__price">
                  <span className="fg-billing-hero__kicker">Monthly price</span>
                  <div className="fg-billing-hero__price-line">
                    <strong>{previewMonthlyEstimateLabel}</strong>
                    <span>per month</span>
                  </div>
                  <div className="fg-billing-hero__meta">
                    <span>{`Envelope ${formatResourceSpec(previewSpec)}`}</span>
                    <span>{`Billed as ${formatResourceSpec(previewBilledSpec)}`}</span>
                    <span>{`Headroom ${formatResourceSpec(previewHeadroom)}`}</span>
                    <span>
                      {previewHourlyRateMicroCents > 0
                        ? `${previewHourlyRateLabel} / hour`
                        : "Paused"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="fg-billing-status-row">
                <StatusBadge tone={readStatusTone(billing)}>{humanizeStatus(billing.status)}</StatusBadge>
                {billing.byoVpsFree ? <StatusBadge tone="info">BYO VPS free</StatusBadge> : null}
              </div>
            </div>
          </PanelSection>

          <PanelSection>
            {callout ? <InlineAlert variant={callout.variant}>{callout.message}</InlineAlert> : null}
            {envelopeExceedsUiCap ? (
              <InlineAlert variant="warning">
                Saved envelope exceeds the temporary 2 cpu / 4 GiB / 30 GiB storage UI cap.
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
                  loadingLabel="Saving envelope…"
                  type="submit"
                  variant="primary"
                >
                  Save envelope
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
                  Refresh
                </Button>
              </div>
            </form>
          </PanelSection>
        </Panel>

        <Panel className="fg-billing-surface fg-billing-surface--balance">
          <PanelSection>
            <div className="fg-billing-balance__head">
              <div className="fg-billing-balance__copy">
                <p className="fg-label fg-panel__eyebrow">Balance</p>
                <PanelTitle>Prepaid credits</PanelTitle>
              </div>

              <div className="fg-billing-status-row">
                <StatusBadge tone={readStatusTone(billing)}>{humanizeStatus(billing.status)}</StatusBadge>
                {billing.balanceRestricted ? (
                  <StatusBadge tone="warning">Top up required for expansion</StatusBadge>
                ) : null}
              </div>
            </div>

            <div className="fg-billing-balance__figures">
              <article className="fg-billing-balance__figure is-primary">
                <span>Available</span>
                <strong>{formatCurrencyFromMicroCents(billing.balanceMicroCents, currency)}</strong>
              </article>

              <article className="fg-billing-balance__figure">
                <span>Consumed</span>
                <strong>{consumedLabel}</strong>
              </article>
            </div>
          </PanelSection>

          <PanelSection>
            <form
              className="fg-settings-form fg-billing-form fg-billing-top-up-form"
              onSubmit={handleTopUpSubmit}
            >
              <FormField
                error={topUpError ?? undefined}
                htmlFor="billing-top-up-amount"
                label="Top-up amount"
              >
                <input
                  className="fg-input"
                  id="billing-top-up-amount"
                  inputMode="decimal"
                  min="0.01"
                  onChange={(event) => {
                    setTopUpAmount(event.target.value);
                    if (topUpError) {
                      setTopUpError(null);
                    }
                  }}
                  placeholder="25.00"
                  step="0.01"
                  type="number"
                  value={topUpAmount}
                />
              </FormField>

              <div className="fg-settings-form__actions fg-billing-top-up-form__actions">
                <Button
                  disabled={parsedTopUpCents === null || parsedTopUpCents <= 0}
                  loading={isToppingUp}
                  loadingLabel="Adding balance…"
                  type="submit"
                  variant="primary"
                >
                  Add balance
                </Button>
              </div>
            </form>
          </PanelSection>
        </Panel>

        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">Ledger</p>
            <PanelTitle>Recent billing events</PanelTitle>
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
