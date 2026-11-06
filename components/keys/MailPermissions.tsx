"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callConsole } from "@/components/workbench/shared";
import { useT } from "@/lib/i18n/client";

export default function MailPermissions({ canEnable }: { canEnable: boolean }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");
  async function enable() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await callConsole("/keys/mail-permissions", { body: {} });
      setEnabled(true);
      router.refresh();
    } catch (cause) {
      setError(t(cause instanceof Error ? cause.message : "Could not enable mail permissions."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel" aria-labelledby="mail-permissions-title">
      <div className="panel-h"><h3 id="mail-permissions-title">{t("Connect an app to Mailflare")}</h3></div>
      <div className="panel-b" style={{ display: "grid", gap: "12px", justifyItems: "start" }}>
        <p style={{ margin: 0 }}>{t("Mailflare requires both app.read and app.write. Select both when creating or editing your integration key.")}</p>
        {canEnable && !enabled && <>
          <p style={{ margin: 0 }}>{t("This older workspace is missing app.read. Enable it for the workspace admin key, then choose it for your integration key. Existing integration keys keep their current permissions.")}</p>
          <button type="button" className="btn primary" disabled={busy} onClick={enable}>
            {t(busy ? "Enabling mail permissions…" : "Enable mail read permission")}
          </button>
        </>}
        {enabled && <p role="status" style={{ margin: 0 }}>{t("Mail read permission enabled. Create or edit a key with app.read and app.write.")}</p>}
        {error && <p role="alert" style={{ margin: 0 }}>{error}</p>}
        <a href="https://mail.fugue.pro/developers" target="_blank" rel="noopener noreferrer">{t("Continue in Mailflare")}</a>
      </div>
    </section>
  );
}
