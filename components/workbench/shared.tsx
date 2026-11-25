"use client";

import Modal from "@/components/ui/Modal";
import Icon from "@/components/ui/Icon";

import { useCallback, useEffect, useRef, useState } from "react";

import { useT } from "@/lib/i18n/client";
import { readConsoleResult } from "@/lib/console/response";

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
  return readConsoleResult<T>(res);
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
      <Icon name="Refresh" />
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
  disabled = false,
}: {
  onAction: () => Promise<unknown>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  onDone?: () => void;
  disabled?: boolean;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (busy || disabled) return;
    setBusy(true);
    setError(null);
    try {
      await onAction();
      setConfirming(false);
      onDone?.();
    } catch (err) {
      if (confirming) throw err;
      setError(err instanceof Error ? err.message : t("Action failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={className} disabled={busy || disabled} onClick={() => confirm ? setConfirming(true) : void run()}>
        {busy ? t("Working…") : children}
      </button>
      {error && <span className="form-hint err action-error" role="alert">{error}</span>}
      {confirming && confirm && <ConfirmDialog title={t("Confirm")} body={<p>{confirm}</p>} onConfirm={run}
        danger={className.includes("danger")} onCancel={() => setConfirming(false)} />}
    </>
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
    <Modal title={title} onDismiss={onCancel} dismissDisabled={busy}>
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
          <button type="button" className="btn ghost" onClick={onCancel} disabled={busy} autoFocus>
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
    </Modal>
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
