"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { callConsole } from "@/components/workbench/shared";
import { useT } from "@/lib/i18n/client";

type KeyStatus = "active" | "disabled" | "deleted";

type KeyRowActionsProps = {
  keyId: string;
  label: string;
  scopes: string[];
  status: KeyStatus;
  availableScopes: string[];
};

/**
 * Per-row Edit / Disable-Enable / Delete controls for a managed API key. Rendered
 * as a client island inside the otherwise server-rendered /keys row so the page
 * stays a server component. Each mutation hits /api/console/keys/{id}/… and then
 * router.refresh() re-renders the row (status chip included) from the mirror.
 *
 * The workspace admin key never renders this component (the page omits it), so
 * these controls only ever act on user-minted keys.
 */
export default function KeyRowActions({
  keyId,
  label,
  scopes,
  status,
  availableScopes,
}: KeyRowActionsProps) {
  const t = useT();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState<"disable" | "delete" | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit-form state (initialised when the modal opens).
  const [editLabel, setEditLabel] = useState(label);
  const [editScopes, setEditScopes] = useState<Set<string>>(
    () => new Set(scopes),
  );

  function openEdit() {
    setEditLabel(label);
    // Only offer scopes that are still grantable; keep any the key already holds
    // even if it dropped out of the grantable set, so an edit never silently
    // strips them.
    setEditScopes(new Set(scopes));
    setError(null);
    setEditing(true);
  }

  function closeAll() {
    if (busy) return;
    setEditing(false);
    setConfirming(null);
    setError(null);
  }

  function toggleScope(scope: string) {
    setEditScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  }

  async function submitEdit() {
    if (busy) return;
    const trimmed = editLabel.trim();
    if (!trimmed) {
      setError(t("Enter a name for the key."));
      return;
    }
    if (editScopes.size === 0) {
      setError(t("Choose at least one scope."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await callConsole(`/keys/${encodeURIComponent(keyId)}`, {
        method: "PATCH",
        body: { label: trimmed, scopes: [...editScopes] },
      });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Action failed."));
    } finally {
      setBusy(false);
    }
  }

  async function runToggle() {
    // Enable is non-destructive → no confirm. Disable is confirmed below.
    if (status === "disabled") {
      setBusy(true);
      setError(null);
      try {
        await callConsole(`/keys/${encodeURIComponent(keyId)}/enable`, {});
        router.refresh();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : t("Action failed."));
      } finally {
        setBusy(false);
      }
      return;
    }
    setConfirming("disable");
  }

  async function confirmAction() {
    if (busy || !confirming) return;
    setBusy(true);
    setError(null);
    try {
      if (confirming === "disable") {
        await callConsole(`/keys/${encodeURIComponent(keyId)}/disable`, {});
      } else {
        await callConsole(`/keys/${encodeURIComponent(keyId)}`, {
          method: "DELETE",
        });
      }
      setConfirming(null);
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
          className="btn sm ghost"
          onClick={runToggle}
          disabled={busy}
        >
          {status === "disabled" ? t("Enable") : t("Disable")}
        </button>
        <button
          type="button"
          className="btn sm ghost danger"
          onClick={() => {
            setError(null);
            setConfirming("delete");
          }}
          disabled={busy}
        >
          {t("Delete")}
        </button>
      </div>

      {editing && (
        <div className="modal-scrim" onClick={closeAll}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <h3>{t("Edit API key")}</h3>
            </div>
            <div className="modal-b">
              <div className="field" style={{ marginBottom: 14 }}>
                <label htmlFor={`edit-key-label-${keyId}`}>{t("Key name")}</label>
                <input
                  id={`edit-key-label-${keyId}`}
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

              <div className="field">
                <label>{t("Scopes")}</label>
                <div className="newkey-scope-bar">
                  <span>{t("{count} selected", { count: editScopes.size })}</span>
                  <div className="newkey-scope-acts">
                    <button
                      type="button"
                      onClick={() => setEditScopes(new Set(availableScopes))}
                    >
                      {t("Select all")}
                    </button>
                    <button type="button" onClick={() => setEditScopes(new Set())}>
                      {t("Clear")}
                    </button>
                  </div>
                </div>
                <div className="newkey-scopes">
                  {availableScopes.map((scope) => {
                    const on = editScopes.has(scope);
                    return (
                      <button
                        key={scope}
                        type="button"
                        className={`scope-pick${on ? " on" : ""}`}
                        aria-pressed={on}
                        onClick={() => toggleScope(scope)}
                      >
                        {scope}
                      </button>
                    );
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
              <h3>
                {confirming === "delete"
                  ? t("Delete API key")
                  : t("Disable API key")}
              </h3>
            </div>
            <div className="modal-b">
              <p style={{ margin: 0 }}>
                {confirming === "delete"
                  ? t(
                      "Permanently delete “{label}”? Any client using this key will immediately lose access. This cannot be undone.",
                      { label },
                    )
                  : t(
                      "Disable “{label}”? Clients using this key will lose access until you enable it again.",
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
                className={confirming === "delete" ? "btn danger" : "btn primary"}
                onClick={confirmAction}
                disabled={busy}
              >
                {busy
                  ? t("Working…")
                  : confirming === "delete"
                    ? t("Delete")
                    : t("Disable")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
