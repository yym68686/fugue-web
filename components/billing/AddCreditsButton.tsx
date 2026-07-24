"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useT } from "@/lib/i18n/client";

// Preset top-up amounts in whole USD. The service enforces the same 5–5000
// bound; these are just convenient defaults.
const PRESET_AMOUNTS = [10, 25, 50, 100] as const;
const MIN_UNITS = 5;
const MAX_UNITS = 5000;

// How long to keep polling a returning checkout before telling the user to
// check back later. Creem usually delivers the webhook within a few seconds.
const STATUS_POLL_INTERVAL_MS = 2500;
const STATUS_POLL_TIMEOUT_MS = 90_000;

const PLUS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

type CheckoutResult = { checkoutUrl: string; requestId: string };
type StatusResult = {
  amountCents: number;
  requestId: string;
  status: "pending" | "processing" | "completed" | "failed" | string;
  units: number;
};

type ApiEnvelope<T> = { ok?: boolean; result?: T; error?: string };

async function postCheckout(amountUsd: number): Promise<CheckoutResult> {
  const res = await fetch("/api/console/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amountUsd }),
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as ApiEnvelope<CheckoutResult>) : null;
  if (!res.ok || !data?.result) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data.result;
}

async function fetchStatus(
  requestId: string,
  signal: AbortSignal,
): Promise<StatusResult> {
  const res = await fetch(
    `/api/console/billing/status?request_id=${encodeURIComponent(requestId)}`,
    { signal },
  );
  const text = await res.text();
  const data = text ? (JSON.parse(text) as ApiEnvelope<StatusResult>) : null;
  if (!res.ok || !data?.result) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data.result;
}

/**
 * "Add credits" action + post-checkout status watcher for the billing page.
 *
 * Two responsibilities, both client-side because the checkout redirect and the
 * return polling need the browser:
 *  1. A modal to pick a whole-USD amount, which opens a Creem checkout and
 *     redirects the tab to the provider.
 *  2. On return (`/billing?request_id=...`), poll the top-up status until it
 *     settles, surface a banner, strip the query param, and refresh the page so
 *     the new balance and ledger row appear.
 */
export function AddCreditsButton() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnedRequestId =
    searchParams.get("request_id") ?? searchParams.get("requestId");

  // ---- checkout modal state ----
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(PRESET_AMOUNTS[1]);
  const [customValue, setCustomValue] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- return-status banner state ----
  const [watching, setWatching] = useState(false);
  const [outcome, setOutcome] = useState<
    { kind: "completed" | "failed" | "timeout"; units?: number } | null
  >(null);

  const effectiveAmount = customValue.trim()
    ? Number(customValue.trim())
    : amount;
  const amountValid =
    Number.isInteger(effectiveAmount) &&
    effectiveAmount >= MIN_UNITS &&
    effectiveAmount <= MAX_UNITS;

  function openModal() {
    setAmount(PRESET_AMOUNTS[1]);
    setCustomValue("");
    setError(null);
    setOpen(true);
  }

  function close() {
    if (redirecting) return;
    setOpen(false);
  }

  function pickPreset(value: number) {
    setAmount(value);
    setCustomValue("");
    setError(null);
  }

  async function startCheckout() {
    if (redirecting) return;
    if (!amountValid) {
      setError(
        t("Enter a whole dollar amount between ${min} and ${max}.", {
          min: MIN_UNITS,
          max: MAX_UNITS,
        }),
      );
      return;
    }    setRedirecting(true);
    setError(null);
    try {
      const checkout = await postCheckout(effectiveAmount);
      // Hand the tab to Creem. On success the user returns to
      // /billing?request_id=... where the watcher below takes over.
      window.location.assign(checkout.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not start checkout."));
      setRedirecting(false);
    }
  }

  // Clear the request_id from the URL without a full navigation, then refresh
  // server data so the balance/ledger reflect the completed top-up.
  const clearReturnParam = useCallback(
    (refresh: boolean) => {
      const url = new URL(window.location.href);
      url.searchParams.delete("request_id");
      url.searchParams.delete("requestId");
      window.history.replaceState(null, "", url.toString());
      if (refresh) router.refresh();
    },
    [router],
  );

  // Poll the returning checkout until it settles or times out.
  useEffect(() => {
    if (!returnedRequestId) return;

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;
    const deadline = Date.now() + STATUS_POLL_TIMEOUT_MS;

    setWatching(true);
    setOutcome(null);

    const finish = (result: NonNullable<typeof outcome>) => {
      if (settled) return;
      settled = true;
      setWatching(false);
      setOutcome(result);
      clearReturnParam(result.kind === "completed");
    };

    const poll = async () => {
      try {
        const status = await fetchStatus(returnedRequestId, controller.signal);
        if (status.status === "completed") {
          finish({ kind: "completed", units: status.units });
          return;
        }
        if (status.status === "failed") {
          finish({ kind: "failed" });
          return;
        }
      } catch {
        if (controller.signal.aborted) return;
        // A transient status error shouldn't abort the whole poll — keep trying
        // until the deadline.
      }
      if (settled) return;
      if (Date.now() >= deadline) {
        finish({ kind: "timeout" });
        return;
      }
      timer = setTimeout(poll, STATUS_POLL_INTERVAL_MS);
    };

    void poll();

    return () => {
      settled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
    // clearReturnParam is stable (memoized on router); returnedRequestId is the
    // real trigger.
  }, [returnedRequestId, clearReturnParam]);

  return (
    <>
      <button type="button" className="btn primary" onClick={openModal}>
        {PLUS_ICON}
        {t("Add credits")}
      </button>

      {watching && (
        <div className="topup-toast run" role="status">
          <span className="spin" aria-hidden />
          {t("Confirming your payment…")}
        </div>
      )}
      {outcome?.kind === "completed" && (
        <div className="topup-toast ok" role="status">
          {t("Credits added. Your balance has been updated.")}
          <button
            type="button"
            className="topup-toast-x"
            onClick={() => setOutcome(null)}
            aria-label={t("Dismiss")}
          >
            ×
          </button>
        </div>
      )}
      {outcome?.kind === "failed" && (
        <div className="topup-toast err" role="alert">
          {t("Payment did not complete. You have not been charged.")}
          <button
            type="button"
            className="topup-toast-x"
            onClick={() => setOutcome(null)}
            aria-label={t("Dismiss")}
          >
            ×
          </button>
        </div>
      )}
      {outcome?.kind === "timeout" && (
        <div className="topup-toast warn" role="status">
          {t("We could not confirm payment yet. Refresh in a few seconds.")}
          <button
            type="button"
            className="topup-toast-x"
            onClick={() => setOutcome(null)}
            aria-label={t("Dismiss")}
          >
            ×
          </button>
        </div>
      )}

      {open && (
        <div className="modal-scrim" onClick={close}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <h3>{t("Add credits")}</h3>
            </div>
            <div className="modal-b">
              <p style={{ marginBottom: 12 }}>
                {t(
                  "Choose an amount to add to your prepaid balance. You'll be redirected to our payment provider to complete the purchase.",
                )}
              </p>

              <div className="field">
                <label>{t("Amount (USD)")}</label>
                <div className="topup-presets">
                  {PRESET_AMOUNTS.map((value) => {
                    const on = !customValue.trim() && amount === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        className={`topup-preset${on ? " on" : ""}`}
                        aria-pressed={on}
                        onClick={() => pickPreset(value)}
                      >
                        ${value}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="field" style={{ marginTop: 12 }}>
                <label htmlFor="topup-custom">{t("Or enter a custom amount")}</label>
                <div className="topup-custom">
                  <span className="topup-custom-prefix">$</span>
                  <input
                    id="topup-custom"
                    className="input mono"
                    type="number"
                    inputMode="numeric"
                    min={MIN_UNITS}
                    max={MAX_UNITS}
                    step={1}
                    value={customValue}
                    placeholder={String(amount)}
                    onChange={(e) => {
                      setCustomValue(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && amountValid) startCheckout();
                    }}
                  />
                </div>
                <div className="form-hint">
                  {t("Whole dollars, ${min}–${max}.", {
                    min: MIN_UNITS,
                    max: MAX_UNITS,
                  })}
                </div>
              </div>

              {error && (
                <div
                  className="wb-alert err"
                  style={{ marginTop: 12, marginBottom: 0 }}
                >
                  {error}
                </div>
              )}
            </div>
            <div className="modal-f">
              <button
                type="button"
                className="btn ghost"
                onClick={close}
                disabled={redirecting}
              >
                {t("Cancel")}
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={startCheckout}
                disabled={redirecting || !amountValid}
              >
                {redirecting
                  ? t("Redirecting…")
                  : t("Continue to payment · ${amount}", { amount: effectiveAmount })}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
