"use client";

import { useEffect, useRef, useState } from "react";

import { callConsole } from "@/components/workbench/shared";
import { useT } from "@/lib/i18n/client";
import { copyText } from "@/lib/ui/clipboard";
import SecretCopyField from "./SecretCopyField";

export default function CopyKeyButton({ keyId, label, available }: {
  keyId: string;
  label: string;
  available: boolean;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fallbackSecret, setFallbackSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function copy() {
    if (busy) return;
    if (!available) {
      setError(t("This key's secret was not saved. Create a new key to copy it."));
      return;
    }
    setBusy(true);
    setCopied(false);
    setError(null);
    if (timer.current) clearTimeout(timer.current);
    try {
      const result = await callConsole<{ secret: string }>(`/keys/${encodeURIComponent(keyId)}/secret`);
      if (!mounted.current) return;
      if (!result?.secret) throw new Error(t("Failed to copy key. Try again."));
      const success = await copyText(result.secret);
      if (!mounted.current) return;
      if (success) {
        setCopied(true);
        timer.current = setTimeout(() => setCopied(false), 2000);
      } else {
        setFallbackSecret(result.secret);
      }
    } catch {
      if (mounted.current) setError(t("Failed to copy key. Try again."));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  function close() {
    setFallbackSecret(null);
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        className="btn ghost sm"
        onClick={copy}
        disabled={busy}
        aria-label={t("Copy key {label}", { label })}
        aria-live="polite"
      >
        {busy ? t("Copying…") : copied ? t("Copied") : t("Copy")}
      </button>
      {(fallbackSecret || error) && (
        <div className="modal-scrim" onClick={close}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-label={t("Copy key {label}", { label })} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") close(); }}>
            <div className="modal-h"><h3>{t("Copy key {label}", { label })}</h3></div>
            <div className="modal-b">
              {error && <p role="alert">{error}</p>}
              {fallbackSecret && (
                <>
                  <p>{t("Automatic copy failed. Select the key and copy it manually.")}</p>
                  <SecretCopyField secret={fallbackSecret} />
                </>
              )}
            </div>
            <div className="modal-f"><button type="button" className="btn primary" autoFocus onClick={close}>{t("Done")}</button></div>
          </div>
        </div>
      )}
    </>
  );
}
