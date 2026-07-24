"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { callConsole } from "@/components/workbench/shared";
import { useT } from "@/lib/i18n/client";

type CreatedResult = {
  secret: string;
  joinCommand: string;
  key: { id: string; label: string; prefix: string | null };
};

const PLUS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/**
 * "Connect node" action for the servers page. Opens a modal to name the node,
 * mints a tenant-runtime node key via POST /api/console/node-keys, then reveals
 * the one-line join command (with the secret embedded) exactly once. Rendered as
 * a client island so the page itself can stay a server component.
 */
export default function ConnectNodeButton() {
  const t = useT();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedResult | null>(null);
  const [copied, setCopied] = useState(false);

  function openModal() {
    setLabel("");
    setError(null);
    setCreated(null);
    setCopied(false);
    setOpen(true);
  }

  function close() {
    if (busy) return;
    setOpen(false);
    // A newly minted key needs to show up in the list.
    if (created) router.refresh();
  }

  async function submit() {
    if (busy) return;
    const trimmed = label.trim();
    if (!trimmed) {
      setError(t("Enter a name for the node."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await callConsole<CreatedResult>("/node-keys", {
        body: { label: trimmed },
      });
      setCreated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Action failed."));
    } finally {
      setBusy(false);
    }
  }

  async function copyCommand() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.joinCommand);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (insecure context); the command is still
      // selectable in the box, so fail quietly.
    }
  }

  return (
    <>
      <button type="button" className="btn primary" onClick={openModal}>
        {PLUS_ICON}
        {t("Connect node")}
      </button>

      {open && (
        <div className="modal-scrim" onClick={close}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            {created ? (
              <>
                <div className="modal-h">
                  <h3>{t("Enroll your server")}</h3>
                </div>
                <div className="modal-b">
                  <p style={{ marginBottom: 10 }}>
                    {t(
                      "Run this on the server you want to connect (as root). For security the key is shown only once.",
                    )}
                  </p>
                  <div className="newkey-secret">
                    <code>{created.joinCommand}</code>
                    <button type="button" className="btn ghost" onClick={copyCommand}>
                      {copied ? t("Copied") : t("Copy")}
                    </button>
                  </div>
                  <div className="newkey-secret-meta">
                    <span className="mono">{created.key.label}</span>
                    {created.key.prefix && (
                      <span className="mono">{created.key.prefix}••••••••</span>
                    )}
                  </div>
                  <p className="form-hint" style={{ marginTop: 10 }}>
                    {t(
                      "The node appears above once it finishes joining the cluster (usually under a minute).",
                    )}
                  </p>
                </div>
                <div className="modal-f">
                  <button type="button" className="btn primary" onClick={close}>
                    {t("Done")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="modal-h">
                  <h3>{t("Connect a server")}</h3>
                </div>
                <div className="modal-b">
                  <div className="field">
                    <label htmlFor="connect-node-label">{t("Node name")}</label>
                    <input
                      id="connect-node-label"
                      className="input"
                      autoFocus
                      value={label}
                      placeholder={t("e.g. hk-edge-1")}
                      maxLength={120}
                      onChange={(e) => setLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submit();
                      }}
                    />
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
                    disabled={busy}
                  >
                    {t("Cancel")}
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={submit}
                    disabled={busy}
                  >
                    {busy ? t("Working…") : t("Generate join command")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
