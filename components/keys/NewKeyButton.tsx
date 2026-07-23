"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { callConsole } from "@/components/workbench/shared";
import { useT } from "@/lib/i18n/client";

type CreatedResult = {
  secret: string;
  key: { id: string; label: string; prefix: string | null; scopes: string[] };
};

const PLUS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/**
 * "New key" action for the access-keys page. Opens a modal to name the key and
 * pick its scopes, mints it via POST /api/console/keys, then reveals the secret
 * exactly once before refreshing the list. Rendered as a client island so the
 * page itself can stay a server component.
 */
export default function NewKeyButton({
  availableScopes,
}: {
  availableScopes: string[];
}) {
  const t = useT();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(availableScopes),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedResult | null>(null);
  const [copied, setCopied] = useState(false);

  function openModal() {
    setLabel("");
    setSelected(new Set(availableScopes));
    setError(null);
    setCreated(null);
    setCopied(false);
    setOpen(true);
  }

  function close() {
    if (busy) return;
    setOpen(false);
    // If a key was just created, the list needs to pick up the new row.
    if (created) router.refresh();
  }

  function toggleScope(scope: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  }

  async function submit() {
    if (busy) return;
    const trimmed = label.trim();
    if (!trimmed) {
      setError(t("Enter a name for the key."));
      return;
    }
    if (selected.size === 0) {
      setError(t("Choose at least one scope."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await callConsole<CreatedResult>("/keys", {
        body: { label: trimmed, scopes: [...selected] },
      });
      setCreated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Failed to create key"));
    } finally {
      setBusy(false);
    }
  }

  async function copySecret() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (insecure context); the secret is still
      // selectable in the field, so fail quietly.
    }
  }

  return (
    <>
      <button type="button" className="btn primary" onClick={openModal}>
        {PLUS_ICON}
        {t("New key")}
      </button>

      {open && (
        <div className="modal-scrim" onClick={close}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            {created ? (
              <>
                <div className="modal-h">
                  <h3>{t("API key created")}</h3>
                </div>
                <div className="modal-b">
                  <p style={{ marginBottom: 10 }}>
                    {t(
                      "Copy your key secret now. For security it won't be shown again.",
                    )}
                  </p>
                  <div className="newkey-secret">
                    <code>{created.secret}</code>
                    <button type="button" className="btn ghost" onClick={copySecret}>
                      {copied ? t("Copied") : t("Copy")}
                    </button>
                  </div>
                  <div className="newkey-secret-meta">
                    <span className="mono">{created.key.label}</span>
                    {created.key.prefix && (
                      <span className="mono">{created.key.prefix}••••••••</span>
                    )}
                  </div>
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
                  <h3>{t("Create API key")}</h3>
                </div>
                <div className="modal-b">
                  <div className="field" style={{ marginBottom: 14 }}>
                    <label htmlFor="newkey-label">{t("Key name")}</label>
                    <input
                      id="newkey-label"
                      className="input"
                      autoFocus
                      value={label}
                      placeholder={t("e.g. ci-deploy")}
                      maxLength={120}
                      onChange={(e) => setLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submit();
                      }}
                    />
                  </div>

                  <div className="field">
                    <label>{t("Scopes")}</label>
                    <div className="newkey-scope-bar">
                      <span>
                        {t("{count} selected", { count: selected.size })}
                      </span>
                      <div className="newkey-scope-acts">
                        <button
                          type="button"
                          onClick={() => setSelected(new Set(availableScopes))}
                        >
                          {t("Select all")}
                        </button>
                        <button type="button" onClick={() => setSelected(new Set())}>
                          {t("Clear")}
                        </button>
                      </div>
                    </div>
                    <div className="newkey-scopes">
                      {availableScopes.map((scope) => {
                        const on = selected.has(scope);
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
                    {busy ? t("Creating…") : t("Create key")}
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
