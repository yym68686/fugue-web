"use client";

import { useState, type FormEvent } from "react";
import type { IntegrationKey } from "@/lib/admin/integration-keys";
import { useI18n } from "@/lib/i18n/client";

type Credential = {
  integration: IntegrationKey;
  deploymentConfigured: boolean;
  overridden: boolean;
  deploymentOnly: boolean;
};

export default function IntegrationSettings({ credential }: { credential: Credential }) {
  const { t } = useI18n();
  const { integration, deploymentConfigured, deploymentOnly } = credential;
  const [overridden, setOverridden] = useState(credential.overridden);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"saved" | "failed" | null>(null);

  async function update(secret: string | null, form?: HTMLFormElement) {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ integration, secret }),
      });
      if (!response.ok) throw new Error();
      setOverridden(secret !== null);
      form?.reset();
      setStatus("saved");
    } catch {
      setStatus("failed");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void update(String(new FormData(form).get("secret") ?? ""), form);
  }

  return (
    <div className="mt-3">
      <div className="muted break-words">{integration} · {t(deploymentOnly ? "Deployment only" : overridden ? "Admin override active" : deploymentConfigured ? "Deployment default" : "Not configured")}</div>
      {!deploymentOnly && deploymentConfigured && (
        <form method="post" action="/api/admin/settings" className="storage-create" onSubmit={submit}>
          <label>{t("New credential")}
            {integration === "GITHUB_APP_PRIVATE_KEY"
              ? <textarea name="secret" autoComplete="off" spellCheck={false} maxLength={8192} required disabled={busy} />
              : <input name="secret" type="password" autoComplete="new-password" maxLength={8192} required disabled={busy} />}
          </label>
          <button className="btn primary" type="submit" disabled={busy}>{t("Save override")}</button>
        </form>
      )}
      {!deploymentOnly && overridden && (
        <button className="btn" type="button" disabled={busy} onClick={() => {
          if (window.confirm(t("Remove this override and use the deployment credential?"))) void update(null);
        }}>{t("Use deployment credential")}</button>
      )}
      {status && <p role={status === "saved" ? "status" : "alert"}>{t(status === "saved" ? "Integration setting updated." : "Could not update the integration credential.")}</p>}
    </div>
  );
}
