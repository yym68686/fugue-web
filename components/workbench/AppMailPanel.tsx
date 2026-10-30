"use client";

import { useEffect, useState } from "react";
import type { AppMailResponse, AppMailState } from "@/lib/fugue/console";
import { useT } from "@/lib/i18n/client";
import { ActionButton, callConsole } from "./shared";

export default function AppMailPanel({ appId }: { appId: string }) {
  const t = useT();
  const path = `/apps/${encodeURIComponent(appId)}/mail`;
  const [data, setData] = useState<AppMailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [localPart, setLocalPart] = useState("support");
  const [secret, setSecret] = useState("");
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(n => n + 1);
  useEffect(() => {
    let stale = false;
    setLoading(true); setError("");
    callConsole<AppMailResponse | null>(path, { method: "GET" }).then(value => { if (!stale) { setData(value); setLoading(false); } }, reason => { if (!stale) { setError(reason instanceof Error ? reason.message : String(reason)); setLoading(false); } });
    return () => { stale = true; };
  }, [path, tick]);
  useEffect(() => { if (!secret) return; const timer = setTimeout(() => setSecret(""), 5 * 60_000); return () => clearTimeout(timer); }, [secret]);

  const state = data?.binding.state;
  async function update(next: AppMailState) {
    const result = await callConsole<AppMailResponse>(path, { method: "PUT", body: { state: next, expected_generation: data?.binding.generation ?? 0, local_part: data?.binding.local_part ?? localPart } });
    setData(result); setSecret(""); refresh();
  }
  return <section className="panel" aria-label={t("Application mail")}>
    <div className="panel-h"><h3>{t("Application mail")}</h3><button type="button" className="btn ghost" onClick={refresh}>{t("Refresh")}</button></div>
    <div className="form">
      <p className="sub">{t("Mail is limited to this application's own subdomain. Platform-root addresses and catch-all routing are unavailable.")}</p>
      {loading && <p role="status">{t("Loading…")}</p>}
      {error && <p className="wb-alert err" role="alert">{error}</p>}
      {!loading && !error && !data && <div className="form-row"><label htmlFor={`mail-name-${appId}`}>{t("Mailbox name")}</label><input id={`mail-name-${appId}`} className="input mono" value={localPart} onChange={event => setLocalPart(event.target.value)} maxLength={64} autoComplete="off" /></div>}
      {data && <>
        <div className="form-row"><label>{t("Status")}</label><span>{state} · v{data.binding.generation} · {data.reconciled ? t("Applied") : t("Pending reconciliation")}</span></div>
        {data.error && <p className="wb-alert err" role="status">{data.error}</p>}
        {data.provider && <>
          <div className="form-row"><label>{t("Transport")}</label><span>{t("Send")}: {data.provider.sendingReady ? t("Configured") : t("Pending")} / {t("Receive")}: {data.provider.receivingReady ? t("Configured") : t("Pending")}</span></div>
          <p className="sub">{t("Transport configuration is not proof of DNS propagation or external delivery.")}</p>
          {data.provider.mxHost && <div className="form-row"><label>MX</label><span className="mono">{data.provider.mxHost}</span></div>}
          <div className="form-row"><label>{t("Messages")}</label><span>{data.provider.usage.messageCount} · {data.provider.usage.attachmentBytes} B</span></div>
          {data.provider.mailboxes.map(box => <div className="form-row" key={box.id}><span className="mono">{box.address}</span>{state === "active" && <ActionButton onAction={async () => { const result = await callConsole<{ key: string }>(`${path}/credentials`, { body: { generation: data.binding.generation, mailbox_id: box.id } }); setSecret(result.key); refresh(); }}>{t("Create scoped API/JMAP key")}</ActionButton>}</div>)}
          {(data.provider.credentials ?? []).map(key => <div className="form-row" key={key.id}><span className="mono">{key.prefix}…</span><span>{key.lastUsedAt ?? t("Never used")}</span><ActionButton className="btn danger" confirm={t("Revoke this mail credential?")} onAction={() => callConsole(`${path}/credentials`, { method: "DELETE", body: { id: key.id } })} onDone={refresh}>{t("Revoke")}</ActionButton></div>)}
        </>}
      </>}
      {secret && <div role="status"><p>{t("Copy this key now. It is shown once and is limited to the selected mailbox.")}</p><input aria-label={t("New mail credential")} className="input mono" value={secret} readOnly autoComplete="off" spellCheck={false} /><button className="btn ghost" type="button" onClick={() => setSecret("")}>{t("Dismiss")}</button></div>}
    </div>
    {!loading && !error && state !== "revoked" && <div className="form-foot">
      {state !== "active" && <ActionButton className="btn primary" onAction={() => update("active")}>{t("Enable mail")}</ActionButton>}
      {state === "active" && <ActionButton confirm={t("Suspend mail and revoke all existing mail credentials?")} onAction={() => update("suspended")}>{t("Suspend mail")}</ActionButton>}
      {data && <ActionButton className="btn danger" confirm={t("Permanently revoke this mail binding? It cannot be reactivated and retained mail will not transfer to a new owner.")} onAction={() => update("revoked")}>{t("Revoke mail")}</ActionButton>}
    </div>}
  </section>;
}
