"use client";

import { useState, type FormEvent } from "react";
import type { ObjectStorageConfigStatus, ObjectStoreProvider } from "@/lib/fugue/console";
import { useI18n } from "@/lib/i18n/client";
import "../storage/storage.css";

export default function ObjectStorageSettings({ provider, initial }: { provider: ObjectStoreProvider; initial: ObjectStorageConfigStatus | null }) {
  const { t } = useI18n();
  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"saved" | "failed" | "conflict" | null>(null);
  const b2 = provider === "backblaze-b2";
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const id = String(fields.get("identity") ?? "").trim();
    const secret = String(fields.get("secret") ?? "").trim();
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(b2 ? { provider, key_id: id, application_key: secret } : { provider, account_id: id, api_token: secret }),
      });
      if (response.status === 409) { setResult("conflict"); return; }
      if (!response.ok) throw new Error();
      const data: { result: ObjectStorageConfigStatus } = await response.json();
      setStatus(data.result);
      form.reset();
      setResult("saved");
    } catch {
      setResult("failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel mt-4 p-4">
      <h2>{b2 ? "Backblaze B2" : "Cloudflare R2"}</h2>
      <p>{t(status === null ? "Status unavailable" : status.configured ? "Configured" : "Not configured")}{status?.account_id ? ` · ${status.account_id}` : ""}{status?.region ? ` · ${status.region}` : ""}</p>
      <p className="muted">{t(b2 ? "Use a non-master B2 application key with bucket, key, and file permissions and no bucket or filename restriction." : "Use a Cloudflare account API token with R2 and account-token management permissions.")}</p>
      <form method="post" action="/api/admin/settings" className="storage-create" onSubmit={(event) => void save(event)}>
        <label>{t(b2 ? "B2 application key ID" : "Cloudflare account ID")}
          <input name="identity" type={b2 ? "password" : "text"} autoComplete="off" spellCheck={false}
            pattern={b2 ? "[A-Za-z0-9]{12,128}" : "[a-f0-9]{32}"} maxLength={b2 ? 128 : 32} required disabled={busy} />
        </label>
        <label>{t(b2 ? "B2 application key" : "Cloudflare API token")}
          <input name="secret" type="password" autoComplete="new-password" minLength={20} maxLength={b2 ? 256 : 512} required disabled={busy} />
        </label>
        <button type="submit" className="btn primary" disabled={busy}>{t(busy ? "Verifying credentials…" : "Verify and save")}</button>
      </form>
      {result && <p role={result === "saved" ? "status" : "alert"}>{t(result === "saved"
        ? "Provider credentials saved."
        : result === "conflict"
          ? "Another storage operation is running, or existing buckets prevent changing the provider account. Check the account and retry."
          : "Could not verify and save the provider credentials. Check the key, permissions, and current settings.")}</p>}
    </section>
  );
}
