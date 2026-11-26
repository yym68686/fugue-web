"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { callConsole } from "@/components/workbench/shared";
import {
  estimateManagedCap,
  managedCapFromSummary,
  readManagedCapDraft,
  sameManagedCap,
} from "@/lib/billing/managed-cap";
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

export function BillingCapEditor({ initial }: { initial: BillingSummary }) {
  const t = useT();
  const router = useRouter();
  const [savedCap, setSavedCap] = useState(() => managedCapFromSummary(initial.managed_cap));
  const [cpuCores, setCpuCores] = useState(() => String(savedCap.cpuMillicores / 1000));
  const [memoryGiB, setMemoryGiB] = useState(() => String(savedCap.memoryMebibytes / 1024));
  const [storageGiB, setStorageGiB] = useState(() => String(savedCap.storageGibibytes));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const book = initial.price_book;
  const currency = book.currency || "USD";
  const draft = readManagedCapDraft(cpuCores, memoryGiB, storageGiB);
  const estimate = draft && estimateManagedCap(draft, book);
  const dirty = !draft || !sameManagedCap(draft, savedCap);

  function edit(setter: (value: string) => void, value: string) {
    setter(value);
    setSaved(false);
    setError(null);
  }

  async function save() {
    if (saving || !dirty || !draft || !estimate) return;
    setSaving(true);
    setError(null);
    try {
      const next = await callConsole<BillingSummary>("/billing", {
        method: "PATCH",
        body: draft,
      });
      const confirmed = managedCapFromSummary(next.managed_cap);
      setSavedCap(confirmed);
      setCpuCores(String(confirmed.cpuMillicores / 1000));
      setMemoryGiB(String(confirmed.memoryMebibytes / 1024));
      setStorageGiB(String(confirmed.storageGibibytes));
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? t(err.message) : t("Save failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-h">
        <h3>{t("Resource caps")}</h3>
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
            step={0.001}
            required
            value={cpuCores}
            disabled={saving}
            onChange={(e) => edit(setCpuCores, e.target.value)}
          />
        </div>
        <div className="form-row">
          <label htmlFor="cap-memory">{t("Memory (GiB)")}</label>
          <input
            id="cap-memory"
            className="input mono"
            type="number"
            min={0}
            step={1 / 1024}
            required
            value={memoryGiB}
            disabled={saving}
            onChange={(e) => edit(setMemoryGiB, e.target.value)}
          />
        </div>
        <div className="form-row">
          <label htmlFor="cap-storage">{t("Storage (GiB)")}</label>
          <input
            id="cap-storage"
            className="input mono"
            type="number"
            min={0}
            step={1}
            required
            value={storageGiB}
            disabled={saving}
            onChange={(e) => edit(setStorageGiB, e.target.value)}
          />
        </div>
        <p className="form-hint">
          {estimate ? t("At the current caps, an estimated {hourly}/hr · {monthly}/month ({hours} hr/month). Actual charges accrue hourly from your credit balance based on the caps.", {
            hourly: fmtMoney(estimate.hourly, currency),
            monthly: fmtMoney(estimate.monthly, currency),
            hours: book.hours_per_month,
          }) : t(draft
            ? "The estimated cost exceeds the supported range."
            : "Resource caps must be non-negative whole numbers in millicores, MiB, and GiB.")}
        </p>
        <p className="form-hint">
          {t("This changes the workspace quota, not the size of an existing app volume.")}
        </p>
        {error && (
          <div role="alert" className="wb-alert err" style={{ marginBottom: 0 }}>
            {error}
          </div>
        )}
        {saved && !dirty && !error && (
          <div role="status" className="form-hint">{t("Saved.")}</div>
        )}
        <div className="form-foot" style={{ padding: 0, border: "none" }}>
          <button type="submit" className="btn primary" disabled={saving || !dirty || !estimate}>
            {saving ? t("Saving…") : t("Save caps")}
          </button>
        </div>
      </form>
    </div>
  );
}

