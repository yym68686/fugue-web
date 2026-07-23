"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useT } from "@/lib/i18n/client";

/* ---- console API client (browser → /api/console/*) ---- */

export type ApiResult<T> = { ok: true; result: T } | { ok: false; error: string };

/** Call a console mutation route. Returns parsed { ok, result } or throws. */
export async function callConsole<T = unknown>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`/api/console${path}`, {
    method: init?.method ?? "POST",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as ApiResult<T> & { error?: string }) : null;
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return (data as { result: T }).result;
}

/* ---- read hook: fetch-once + manual refresh, with abort ---- */

export type EndpointState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
};

/**
 * GET a console read endpoint. Refetches when `url` changes or refresh() is
 * called. Cancels in-flight requests and rejects stale responses.
 */
export function useEndpointData<T>(url: string | null): EndpointState<T> {
  const t = useT();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(url));
  const [tick, setTick] = useState(0);
  const reqId = useRef(0);

  useEffect(() => {
    if (!url) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    fetch(url, { signal: ctrl.signal, cache: "no-store" })
      .then(async (res) => {
        const text = await res.text();
        const body = text ? JSON.parse(text) : null;
        if (!res.ok) throw new Error(body?.error || t("Failed to load ({status})", { status: res.status }));
        if (id !== reqId.current) return;
        setData((body?.result ?? body) as T);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted || id !== reqId.current) return;
        setError(err instanceof Error ? err.message : t("Failed to load."));
        setLoading(false);
      });

    return () => ctrl.abort();
  }, [url, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, refresh };
}

/* ---- refresh button ---- */

export function RefreshButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button type="button" className="btn ghost" onClick={onClick}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 4v6h-6M1 20v-6h6" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
      {t("Refresh")}
    </button>
  );
}

/* ---- action button with loading + error toast ---- */

export function ActionButton({
  onAction,
  children,
  className = "btn",
  confirm,
  onDone,
}: {
  onAction: () => Promise<unknown>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  onDone?: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (busy) return;
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    try {
      await onAction();
      onDone?.();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("Action failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={className} disabled={busy} onClick={run}>
      {busy ? t("Working…") : children}
    </button>
  );
}

/* ---- confirm dialog (for destructive actions) ---- */

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolvedConfirmLabel = confirmLabel ?? t("Confirm");

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Action failed."));
      setBusy(false);
    }
  }

  return (
    <div className="modal-scrim" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h3>{title}</h3>
        </div>
        <div className="modal-b">
          {body}
          {error && (
            <div className="wb-alert err" style={{ marginTop: 12, marginBottom: 0 }}>
              {error}
            </div>
          )}
        </div>
        <div className="modal-f">
          <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>
            {t("Cancel")}
          </button>
          <button
            type="button"
            className={danger ? "btn danger" : "btn primary"}
            onClick={confirm}
            disabled={busy}
          >
            {busy ? t("Working…") : resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- small presentational helpers ---- */

export function TabError({ message }: { message: string }) {
  return <div className="wb-alert err">{message}</div>;
}

export function TabLoading() {
  return (
    <div className="panel">
      <div className="sk sk-block" style={{ margin: 14 }} />
      <div className="sk sk-line" style={{ margin: "0 14px 10px" }} />
      <div className="sk sk-line" style={{ margin: "0 14px 14px", width: "60%" }} />
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="empty">{message}</div>;
}
