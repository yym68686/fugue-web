"use client";

import { useMemo, useState } from "react";
import { callConsole } from "@/components/workbench/shared";
import type { BillingSummary } from "@/lib/fugue/console";
import { useT } from "@/lib/i18n/client";

const MICRO_CENTS_PER_DOLLAR = 100_000_000;

/** Format a microcents value as a currency string (extra precision for tiny rates). */
function fmtMoney(microcents: number, currency = "USD"): string {
  const amount = microcents / MICRO_CENTS_PER_DOLLAR;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: amount !== 0 && Math.abs(amount) < 0.01 ? 6 : 2,
  }).format(amount);
}

/** Compute the hourly accrual (microcents/hr) for a cap under a price book. */
function hourlyRate(
  book: BillingSummary["price_book"],
  cpuMillicores: number,
  memoryMebibytes: number,
  storageGibibytes: number,
): number {
  return (
    cpuMillicores * book.cpu_microcents_per_millicore_hour +
    memoryMebibytes * book.memory_microcents_per_mib_hour +
    storageGibibytes * book.storage_microcents_per_gib_hour
  );
}

export function BillingCapEditor({ initial }: { initial: BillingSummary }) {
  const t = useT();
  const [summary, setSummary] = useState<BillingSummary>(initial);
  // Whether the tenant's cap tracks storage at all — if the backend never
  // reported a storage cap, we leave storage out of the PATCH entirely.
  const hasStorageCap = initial.managed_cap.storage_gibibytes !== undefined;

  const [cpuCores, setCpuCores] = useState(
    (summary.managed_cap.cpu_millicores ?? 0) / 1000,
  );
  const [memoryGiB, setMemoryGiB] = useState(
    (summary.managed_cap.memory_mebibytes ?? 0) / 1024,
  );
  const [storageGiB, setStorageGiB] = useState(
    summary.managed_cap.storage_gibibytes ?? 0,
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const book = summary.price_book;
  const currency = book.currency || "USD";

  // Live estimate from the edited cap — this is what the tenant will accrue.
  const estimate = useMemo(() => {
    const cpuMillicores = Math.round(cpuCores * 1000);
    const memoryMebibytes = Math.round(memoryGiB * 1024);
    const storageGibibytes = hasStorageCap ? Math.round(storageGiB) : 0;
    const hourly = hourlyRate(book, cpuMillicores, memoryMebibytes, storageGibibytes);
    return { hourly, monthly: hourly * book.hours_per_month };
  }, [cpuCores, memoryGiB, storageGiB, hasStorageCap, book]);

  function edit(setter: (v: number) => void, value: number) {
    setter(Number.isFinite(value) ? value : 0);
    setDirty(true);
    setSaved(false);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const next = await callConsole<BillingSummary>("/billing", {
        method: "PATCH",
        body: {
          cpuMillicores: Math.round(cpuCores * 1000),
          memoryMebibytes: Math.round(memoryGiB * 1024),
          ...(hasStorageCap ? { storageGibibytes: Math.round(storageGiB) } : {}),
        },
      });
      setSummary(next);
      setCpuCores((next.managed_cap.cpu_millicores ?? 0) / 1000);
      setMemoryGiB((next.managed_cap.memory_mebibytes ?? 0) / 1024);
      setStorageGiB(next.managed_cap.storage_gibibytes ?? 0);
      setDirty(false);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Save failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-h">
        <h3>{t("Resource caps")}</h3>
        <div className="tail eyebrow">{t("Billed hourly")}</div>
      </div>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="form-row">
          <label htmlFor="cap-cpu">{t("CPU (cores)")}</label>
          <input
            id="cap-cpu"
            className="input mono"
            type="number"
            min={0}
            step={0.1}
            value={cpuCores}
            disabled={saving}
            onChange={(e) => edit(setCpuCores, Number(e.target.value))}
          />
        </div>
        <div className="form-row">
          <label htmlFor="cap-memory">{t("Memory (GiB)")}</label>
          <input
            id="cap-memory"
            className="input mono"
            type="number"
            min={0}
            step={0.5}
            value={memoryGiB}
            disabled={saving}
            onChange={(e) => edit(setMemoryGiB, Number(e.target.value))}
          />
        </div>
        {hasStorageCap && (
          <div className="form-row">
            <label htmlFor="cap-storage">{t("Storage (GiB)")}</label>
            <input
              id="cap-storage"
              className="input mono"
              type="number"
              min={0}
              step={1}
              value={storageGiB}
              disabled={saving}
              onChange={(e) => edit(setStorageGiB, Number(e.target.value))}
            />
          </div>
        )}
        <div className="wb-alert ok" style={{ marginBottom: 0 }}>
          {t("At the current caps, an estimated {hourly}/hr · {monthly}/month ({hours} hr/month). Actual charges accrue hourly from your credit balance based on the caps.", {
            hourly: fmtMoney(estimate.hourly, currency),
            monthly: fmtMoney(estimate.monthly, currency),
            hours: book.hours_per_month,
          })}
        </div>
        {error && (
          <div className="wb-alert err" style={{ marginBottom: 0 }}>
            {error}
          </div>
        )}
        {saved && !dirty && !error && (
          <div className="form-hint">{t("Saved.")}</div>
        )}
        <div className="form-foot" style={{ padding: 0, border: "none" }}>
          <button type="submit" className="btn primary" disabled={saving || !dirty}>
            {saving ? t("Saving…") : t("Save caps")}
          </button>
        </div>
      </form>
    </div>
  );
}

