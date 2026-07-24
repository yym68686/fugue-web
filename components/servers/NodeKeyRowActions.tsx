"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { callConsole } from "@/components/workbench/shared";
import { useT } from "@/lib/i18n/client";

type NodeKeyRowActionsProps = {
  keyId: string;
  label: string;
  status: "active" | "revoked";
};

/**
 * Per-row Edit (rename) / Disable (revoke) controls for a node-enrollment key.
 * Rename is local-only (PATCH sets label_override); revoke hits the control
 * plane then mirrors status='revoked'. Rendered as a client island inside the
 * server-rendered /servers row. Revoked keys show no actions.
 */
export default function NodeKeyRowActions({
  keyId,
  label,
  status,
}: NodeKeyRowActionsProps) {
  const t = useT();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState(label);

  if (status === "revoked") return null;

  function openEdit() {
    setEditLabel(label);
    setError(null);
    setEditing(true);
  }

  function closeAll() {
    if (busy) return;
    setEditing(false);
    setConfirming(false);
    setError(null);
  }

  async function submitEdit() {
    if (busy) return;
    const trimmed = editLabel.trim();
    if (!trimmed) {
      setError(t("Enter a name for the node."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await callConsole(`/node-keys/${encodeURIComponent(keyId)}`, {
        method: "PATCH",
        body: { label: trimmed },
      });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Action failed."));
    } finally {
      setBusy(false);
    }
  }

  async function confirmRevoke() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await callConsole(`/node-keys/${encodeURIComponent(keyId)}/revoke`, {});
      setConfirming(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Action failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="row-acts">
        <button
          type="button"
          className="btn sm ghost"
          onClick={openEdit}
          disabled={busy}
        >
          {t("Edit")}
        </button>
        <button
          type="button"
          className="btn sm ghost danger"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
          disabled={busy}
        >
          {t("Disable")}
        </button>
      </div>

      {editing && (
        <div className="modal-scrim" onClick={closeAll}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <h3>{t("Rename node")}</h3>
            </div>
            <div className="modal-b">
              <div className="field">
                <label htmlFor={`edit-node-label-${keyId}`}>{t("Node name")}</label>
                <input
                  id={`edit-node-label-${keyId}`}
                  className="input"
                  autoFocus
                  value={editLabel}
                  maxLength={120}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitEdit();
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
                onClick={closeAll}
                disabled={busy}
              >
                {t("Cancel")}
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={submitEdit}
                disabled={busy}
              >
                {busy ? t("Working…") : t("Save changes")}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirming && (
        <div className="modal-scrim" onClick={closeAll}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <h3>{t("Disable node key")}</h3>
            </div>
            <div className="modal-b">
              <p style={{ margin: 0 }}>
                {t(
                  "Disable “{label}”? Any server enrolled with this key will be disconnected and it can no longer be used to join.",
                  { label },
                )}
              </p>
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
                onClick={closeAll}
                disabled={busy}
              >
                {t("Cancel")}
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={confirmRevoke}
                disabled={busy}
              >
                {busy ? t("Working…") : t("Disable")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
