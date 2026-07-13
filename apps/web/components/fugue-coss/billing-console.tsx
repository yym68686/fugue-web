"use client";

import { Alert, AlertDescription, AlertTitle } from "@fugue/ui/components/alert";
import { Badge } from "@fugue/ui/components/badge";
import { Button } from "@fugue/ui/components/button";
import { Card, CardContent, CardFrame } from "@fugue/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@fugue/ui/components/empty";
import { Field, FieldLabel } from "@fugue/ui/components/field";
import { Form } from "@fugue/ui/components/form";
import { Input } from "@fugue/ui/components/input";
import { Skeleton } from "@fugue/ui/components/skeleton";
import { toastManager } from "@fugue/ui/components/toast";
import { Save } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import {
  ConsoleLoadError,
  ConsoleLoadingState,
} from "@/components/console/async-state";
import { ConsoleCardHeader } from "@/components/console/card-header";
import { DataTable } from "@/components/console/data-table";
import { MetricStrip } from "@/components/console/metric-strip";
import {
  CONSOLE_BILLING_PAGE_USAGE_SNAPSHOT_URL,
  invalidateConsolePageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";
import type { ConsoleBillingPageSnapshot } from "@/lib/console/page-snapshot-types";
import type { BillingStateMessages } from "@/lib/i18n/console-messages";
import type { Locale } from "@/lib/i18n/core";
import { readRequestError, requestJson } from "@/lib/ui/request-json";

function useToast() {
  return {
    notify(value: string) {
      toastManager.add({ title: value });
    },
  };
}

type CossBadgeTone = "default" | "success" | "warning" | "destructive" | "info";

function formatBytes(
  locale: Locale,
  value: number | null | undefined,
  unknown: string,
) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return unknown;
  }

  if (value === 0) {
    return "0 bytes";
  }

  const units = ["bytes", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(value) / Math.log(1024)),
  );
  const amount = value / 1024 ** index;

  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: index === 0 ? 0 : 1,
  }).format(amount)} ${units[index]}`;
}

function DetailMetric({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <Card className="coss-card--muted">
      <CardContent className="coss-stack-sm">
        <span className="coss-help">{label}</span>
        <strong className={mono ? "coss-mono" : undefined}>{value}</strong>
      </CardContent>
    </Card>
  );
}

type ReadyBillingSnapshot = Extract<ConsoleBillingPageSnapshot, { state: "ready" }>;
type BillingSummary = NonNullable<ReadyBillingSnapshot["data"]["billing"]>;
type BillingEventRow = BillingSummary["events"][number] & {
  id: string;
};

const MICRO_CENTS_PER_DOLLAR = 100_000_000;

function formatCurrencyMicroCents(
  locale: Locale,
  value: number,
  currency: string,
  maximumFractionDigits = 2,
) {
  return new Intl.NumberFormat(locale, {
    currency,
    maximumFractionDigits,
    minimumFractionDigits: Math.min(2, maximumFractionDigits),
    style: "currency",
  }).format(value / MICRO_CENTS_PER_DOLLAR);
}

function formatBillingRate(locale: Locale, value: number, currency: string) {
  const amount = value / MICRO_CENTS_PER_DOLLAR;

  return new Intl.NumberFormat(locale, {
    currency,
    maximumFractionDigits: amount < 0.01 ? 6 : 4,
    minimumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

function formatBillingCpu(cpuMillicores: number) {
  const cores = cpuMillicores / 1000;
  return `${Number.isInteger(cores) ? cores : cores.toFixed(2)} CPU`;
}

function formatBillingMemory(memoryMebibytes: number) {
  const gib = memoryMebibytes / 1024;
  return `${Number.isInteger(gib) ? gib : gib.toFixed(2)} GiB`;
}

function formatBillingSpec(spec: BillingSummary["managedCap"]) {
  return [
    formatBillingCpu(spec.cpuMillicores),
    formatBillingMemory(spec.memoryMebibytes),
    `${spec.storageGibibytes} GiB storage`,
  ].join(" / ");
}

function formatRunwayHours(value: number | null, unavailable: string) {
  if (value === null) {
    return unavailable;
  }

  if (value < 1) {
    return `${Math.round(value * 60)} min`;
  }

  if (value < 48) {
    return `${Math.round(value)} hr`;
  }

  return `${Math.round(value / 24)} days`;
}

function formatBillingDate(locale: Locale, value: string | null, unknown: string) {
  if (!value) {
    return unknown;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return unknown;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function billingStatusTone(billing: BillingSummary): CossBadgeTone {
  if (billing.overCap || billing.status === "over-cap") return "warning";
  if (billing.balanceRestricted || billing.status === "restricted") return "warning";
  if (billing.status === "active") return "success";
  if (billing.status === "paused") return "info";
  return "default";
}

function billingEventTone(event: BillingSummary["events"][number]): CossBadgeTone {
  return event.amountMicroCents >= 0 ? "success" : "warning";
}

export function BillingConsole({
  locale,
  messages,
}: {
  locale: Locale;
  messages: BillingStateMessages;
}) {
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleBillingPageSnapshot>(
      CONSOLE_BILLING_PAGE_USAGE_SNAPSHOT_URL,
      {
        ttlMs: 30_000,
      },
    );
  const ready = data?.state === "ready" ? data : null;
  const billing = ready?.data.billing ?? null;
  const [cpuCores, setCpuCores] = useState(0);
  const [memoryGiB, setMemoryGiB] = useState(0);
  const [storageGiB, setStorageGiB] = useState(0);
  const [topUpAmount, setTopUpAmount] = useState(50);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!billing || dirty) {
      return;
    }

    setCpuCores(billing.managedCap.cpuMillicores / 1000);
    setMemoryGiB(billing.managedCap.memoryMebibytes / 1024);
    setStorageGiB(billing.managedCap.storageGibibytes);
  }, [billing, dirty]);

  async function refreshBilling() {
    setActionError(null);
    invalidateConsolePageSnapshot(CONSOLE_BILLING_PAGE_USAGE_SNAPSHOT_URL);
    await refresh({ force: true });
  }

  async function saveBillingCap() {
    setSaving(true);
    setActionError(null);

    try {
      await requestJson<{ billing: BillingSummary }>("/api/fugue/billing", {
        body: JSON.stringify({
          managedCap: {
            cpuMillicores: Math.round(cpuCores * 1000),
            memoryMebibytes: Math.round(memoryGiB * 1024),
            storageGibibytes: Math.round(storageGiB),
          },
        }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      setDirty(false);
      await refreshBilling();
      toast.notify("Billing cap saved.");
    } catch (nextError) {
      setActionError(readRequestError(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function startCheckout() {
    setCheckoutLoading(true);
    setActionError(null);

    try {
      const checkout = await requestJson<{ checkoutUrl: string; requestId: string }>(
        "/api/fugue/billing/top-ups/checkout",
        {
          body: JSON.stringify({ amountUsd: topUpAmount }),
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
      window.location.assign(checkout.checkoutUrl);
    } catch (nextError) {
      setActionError(readRequestError(nextError));
      setCheckoutLoading(false);
    }
  }

  const currency = billing?.priceBook.currency ?? "USD";
  const billingSyncError = ready?.data.syncError ?? null;
  const imageStorageLabel =
    ready?.data.imageStorageBytes === null ||
    ready?.data.imageStorageBytes === undefined
      ? messages.syncing
      : formatBytes(locale, ready.data.imageStorageBytes, messages.unknown);
  const eventRows: BillingEventRow[] = (billing?.events ?? []).map((event) => ({
    ...event,
    id: event.id,
  }));

  return (
    <div className="coss-stack">
      {error ? (
        <ConsoleLoadError
          description={error}
          onRetry={refreshBilling}
          retryLabel={messages.retry}
          title={messages.billingUnavailable}
        />
      ) : null}
      {actionError ? (
        <Alert variant="error" role="alert">
          <AlertTitle>{messages.actionFailed}</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}
      {data?.state === "workspace-missing" ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{messages.workspaceNotReady}</EmptyTitle>
            <EmptyDescription>{messages.workspaceNotReadyDescription}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      {loading && !ready ? (
        <ConsoleLoadingState className="coss-stack-sm" label="Loading billing">
          <Skeleton
            style={{
              height: 72,
            }}
          />
          <Skeleton
            style={{
              height: 220,
            }}
          />
        </ConsoleLoadingState>
      ) : null}
      {ready && !billing ? (
        <Alert variant="warning" role="status">
          <AlertTitle>{messages.snapshotUnavailable}</AlertTitle>
          <AlertDescription>
            {ready.data.syncError ?? messages.snapshotFallback}
          </AlertDescription>
        </Alert>
      ) : null}
      {billing ? (
        <>
          <MetricStrip
            items={[
              {
                label: "Prepaid balance",
                value: formatCurrencyMicroCents(
                  locale,
                  billing.balanceMicroCents,
                  currency,
                ),
                tone: billingStatusTone(billing),
              },
              {
                label: "Runway",
                value: formatRunwayHours(billing.runwayHours, messages.unavailable),
                tone:
                  billing.runwayHours === null
                    ? undefined
                    : billing.runwayHours < 72
                      ? "warning"
                      : "success",
              },
              {
                label: "Current usage",
                value: `${formatCurrencyMicroCents(locale, billing.hourlyRateMicroCents, currency)}/hr`,
              },
              {
                label: "Image storage",
                value: imageStorageLabel,
              },
            ]}
          />
          {billingSyncError ? (
            <Alert variant="warning" role="status">
              <AlertTitle>{messages.partialSnapshot}</AlertTitle>
              <AlertDescription>{billingSyncError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="coss-split">
            <CardFrame>
              <ConsoleCardHeader
                title="Managed capacity envelope"
                description="Saved CPU, memory, and storage cap for this Fugue tenant."
              />
              <CardContent>
                <Form
                  className="coss-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveBillingCap();
                  }}
                >
                  <Field data-disabled={saving || undefined}>
                    <FieldLabel htmlFor="billing-cap-cpu">CPU cores</FieldLabel>
                    <Input
                      autoComplete="off"
                      disabled={saving}
                      id="billing-cap-cpu"
                      min={0}
                      name="cpuCores"
                      step={0.1}
                      type="number"
                      value={cpuCores}
                      onChange={(event) => {
                        setDirty(true);
                        setCpuCores(Number(event.target.value));
                      }}
                    />
                  </Field>
                  <Field data-disabled={saving || undefined}>
                    <FieldLabel htmlFor="billing-cap-memory">Memory GiB</FieldLabel>
                    <Input
                      autoComplete="off"
                      disabled={saving}
                      id="billing-cap-memory"
                      min={0}
                      name="memoryGiB"
                      step={0.5}
                      type="number"
                      value={memoryGiB}
                      onChange={(event) => {
                        setDirty(true);
                        setMemoryGiB(Number(event.target.value));
                      }}
                    />
                  </Field>
                  <Field data-disabled={saving || undefined}>
                    <FieldLabel htmlFor="billing-cap-storage">Storage GiB</FieldLabel>
                    <Input
                      autoComplete="off"
                      disabled={saving}
                      id="billing-cap-storage"
                      min={0}
                      name="storageGiB"
                      step={1}
                      type="number"
                      value={storageGiB}
                      onChange={(event) => {
                        setDirty(true);
                        setStorageGiB(Number(event.target.value));
                      }}
                    />
                  </Field>
                  <Alert variant="info" role="status">
                    <AlertTitle>{messages.savedCap}</AlertTitle>
                    <AlertDescription>
                      {formatBillingSpec(billing.managedCap)}· monthly estimate{" "}
                      {formatCurrencyMicroCents(
                        locale,
                        billing.monthlyEstimateMicroCents,
                        currency,
                      )}
                    </AlertDescription>
                  </Alert>
                  <Button loading={saving} type="submit">
                    {saving ? null : <Save aria-hidden="true" />}
                    Save envelope
                  </Button>
                </Form>
              </CardContent>
            </CardFrame>
            <CardFrame>
              <ConsoleCardHeader
                title="Top up"
                description="Start a checkout for prepaid balance."
              />
              <CardContent>
                <Form
                  className="coss-stack"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void startCheckout();
                  }}
                >
                  <Field data-disabled={checkoutLoading || undefined}>
                    <FieldLabel htmlFor="billing-top-up-amount">Amount USD</FieldLabel>
                    <Input
                      autoComplete="off"
                      disabled={checkoutLoading}
                      id="billing-top-up-amount"
                      min={5}
                      name="topUpAmount"
                      step={1}
                      type="number"
                      value={topUpAmount}
                      onChange={(event) => setTopUpAmount(Number(event.target.value))}
                    />
                  </Field>
                  <Button loading={checkoutLoading} type="submit">
                    Start checkout
                  </Button>
                  <div className="coss-grid-2">
                    <DetailMetric label="Status" value={billing.status} />
                    <DetailMetric
                      label="Updated"
                      value={formatBillingDate(
                        locale,
                        billing.updatedAt,
                        messages.unknown,
                      )}
                    />
                  </div>
                </Form>
              </CardContent>
            </CardFrame>
          </div>
          <CardFrame>
            <ConsoleCardHeader
              title="Billing events"
              description="Usage, top-ups, and managed capacity changes from Fugue."
            />
            <CardContent>
              {eventRows.length ? (
                <DataTable
                  columns={["Event", "Amount", "Balance", "Created"]}
                  rows={eventRows}
                  renderRow={(row) => (
                    <tr key={row.id}>
                      <td>
                        <Badge variant={billingEventTone(row)}>{row.type}</Badge>
                      </td>
                      <td>
                        {formatCurrencyMicroCents(
                          locale,
                          row.amountMicroCents,
                          currency,
                        )}
                      </td>
                      <td>
                        {formatCurrencyMicroCents(
                          locale,
                          row.balanceAfterMicroCents,
                          currency,
                        )}
                      </td>
                      <td>
                        {formatBillingDate(locale, row.createdAt, messages.unknown)}
                      </td>
                    </tr>
                  )}
                />
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>{messages.noEvents}</EmptyTitle>
                    <EmptyDescription>{messages.noEventsDescription}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </CardFrame>
          <CardFrame>
            <ConsoleCardHeader
              title="Price book"
              description="Rates from the current Fugue billing summary."
            />
            <CardContent>
              <DataTable
                columns={["Resource", "Rate", "Boundary"]}
                rows={[
                  {
                    boundary: "Managed CPU usage",
                    id: "cpu",
                    rate: `${formatBillingRate(locale, billing.priceBook.cpuMicroCentsPerMillicoreHour * 1000, currency)}/core-hour`,
                    resource: "CPU core",
                  },
                  {
                    boundary: "Managed memory usage",
                    id: "memory",
                    rate: `${formatBillingRate(locale, billing.priceBook.memoryMicroCentsPerMibHour * 1024, currency)}/GiB-hour`,
                    resource: "Memory GiB",
                  },
                  {
                    boundary: "Managed storage usage",
                    id: "storage",
                    rate: `${formatBillingRate(locale, billing.priceBook.storageMicroCentsPerGibHour, currency)}/GiB-hour`,
                    resource: "Storage GiB",
                  },
                ]}
                renderRow={(row) => (
                  <tr key={row.id}>
                    <td>{row.resource}</td>
                    <td>{row.rate}</td>
                    <td>{row.boundary}</td>
                  </tr>
                )}
              />
            </CardContent>
          </CardFrame>
        </>
      ) : null}
    </div>
  );
}
