"use client";

import { useEffect, useState } from "react";
import type { AppMailResponse, AppMailState, AppMailDNSObservation } from "@/lib/fugue/console";
import { mailAPIExample, mailDNSBelongsToBinding, mailServiceOrigin } from "@/lib/fugue/mail-help";
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
  const [mailboxPassword, setMailboxPassword] = useState("");
  const [tick, setTick] = useState(0);
  const [dns, setDNS] = useState<AppMailDNSObservation | null>(null);
  const refresh = () => setTick(n => n + 1);
  useEffect(() => {
    let stale = false;
    setLoading(true); setError("");
    callConsole<AppMailResponse | null>(path, { method: "GET" }).then(value => { if (!stale) { setData(value); setLoading(false); } }, reason => { if (!stale) { setError(reason instanceof Error ? reason.message : String(reason)); setLoading(false); } });
    return () => { stale = true; };
  }, [path, tick]);
  useEffect(() => { if (!secret) return; const timer = setTimeout(() => setSecret(""), 5 * 60_000); return () => clearTimeout(timer); }, [secret]);
  useEffect(() => { if (!mailboxPassword) return; const timer = setTimeout(() => setMailboxPassword(""), 5 * 60_000); return () => clearTimeout(timer); }, [mailboxPassword]);

  const state = data?.binding.state;
  const serviceOrigin = mailServiceOrigin(data?.service_url);
  const currentDNS = data && mailDNSBelongsToBinding(dns, data.binding) ? dns : null;
  async function update(next: AppMailState) {
    const result = await callConsole<AppMailResponse>(path, { method: "PUT", body: { state: next, expected_generation: data?.binding.generation ?? 0, local_part: data?.binding.local_part ?? localPart } });
    setData(result); setSecret(""); setMailboxPassword(""); setDNS(null); refresh();
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
          <div className="form-row"><label>{t("Outbound delivery jobs")}</label><span>{data.provider.usage.outbound.map(job => `${job.status}: ${job.count}`).join(" · ") || t("None")}</span></div>
          {data.provider.mailboxes.map(box => <div className="form-row" key={box.id}><span className="mono">{box.address}</span>{state === "active" && <>
            <ActionButton onAction={async () => { const result = await callConsole<{ key: string }>(`${path}/credentials`, { body: { generation: data.binding.generation, mailbox_id: box.id } }); setSecret(result.key); refresh(); }}>{t("Create scoped API/JMAP key")}</ActionButton>
            <ActionButton confirm={t("Rotate the mailbox password and sign out its Web sessions and devices?")} onAction={async () => { setMailboxPassword(""); const result = await callConsole<{ password?: string }>(`${path}/login`, { body: { generation: data.binding.generation, mailbox_id: box.id, enabled: true } }); setMailboxPassword(result.password ?? ""); refresh(); }}>{t("Rotate mailbox Web password")}</ActionButton>
            {box.loginEnabled && <ActionButton confirm={t("Disable mailbox Web login and sign out its sessions and devices?")} onAction={async () => { await callConsole(`${path}/login`, { body: { generation: data.binding.generation, mailbox_id: box.id, enabled: false } }); setMailboxPassword(""); refresh(); }}>{t("Disable mailbox Web login")}</ActionButton>}
          </>}</div>)}
          {(data.provider.credentials ?? []).map(key => <div className="form-row" key={key.id}><span className="mono">{key.prefix}…</span><span>{key.lastUsedAt ?? t("Never used")}</span><ActionButton className="btn danger" confirm={t("Revoke this mail credential?")} onAction={() => callConsole(`${path}/credentials`, { method: "DELETE", body: { id: key.id } })} onDone={refresh}>{t("Revoke")}</ActionButton></div>)}
        </>}
        {state === "active" && <div>
          <ActionButton onAction={async () => setDNS(await callConsole<AppMailDNSObservation>(`${path}/dns`, { method: "GET" }))}>{t("Check mail DNS")}</ActionButton>
          <p className="sub">{t("Read-only recursive DNS observation. This does not change DNS or prove global propagation, SMTP reachability, or delivery.")}</p>
          {currentDNS && <>
            <p role="status">{t("Mail DNS")}: {t(currentDNS.status === "verified" ? "Records match" : currentDNS.status === "unconfigured" ? "No mail DNS policy" : currentDNS.status === "inactive" ? "Mail DNS inactive" : "Pending DNS checks")} · {currentDNS.checked_at}</p>
            {currentDNS.records.map((record, i) => <details key={`${record.hostname}-${record.type}-${i}`}>
              <summary><span className="mono">{record.hostname} {record.type}</span> · {t(record.status === "match" ? "Record matches" : record.status === "unknown" ? "DNS query unavailable" : "Record differs")}</summary>
              <p>{t("Expected")}</p><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{record.expected.join("\n")}</pre>
              <p>{t("Observed")}</p><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{record.observed.join("\n") || t("None")}</pre>
            </details>)}
          </>}
        </div>}
        {serviceOrigin && data.provider && <details>
          <summary>{t("Mailbox access and API instructions")}</summary>
          <p><a href={serviceOrigin} target="_blank" rel="noopener noreferrer">{t("Open Mailflare")}</a> · {t("Use the mailbox account type and a separately enabled mailbox password. API keys do not work as Web passwords.")}</p>
          <p>{t("Use a scoped key from this panel as a Bearer token. It grants access only to its selected mailbox. Store it on your server, not in browser code.")}</p>
          <p>GET <code>{serviceOrigin}/api/v1/messages?mailboxId={data.provider.mailboxes[0]?.id}&amp;direction=inbound</code></p>
          <p>JMAP Session: <code>{serviceOrigin}/jmap/session</code></p>
          <p>{t("Use apiUrl and account IDs returned by the JMAP Session. IMAP and SMTP submission are not provided.")}</p>
          {data.provider.mailboxes.map(box => <pre key={box.id} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{mailAPIExample(serviceOrigin, box)}</pre>)}
          <p className="sub">{t("For an empty, invalid, or interrupted send response, keep the draft and request key, check Sent, then retry only with the same key. Never automatically create another send.")}</p>
        </details>}
      </>}
      {secret && <div role="status"><p>{t("Copy this key now. It is shown once and is limited to the selected mailbox.")}</p><input aria-label={t("New mail credential")} className="input mono" value={secret} readOnly autoComplete="off" spellCheck={false} /><button className="btn ghost" type="button" onClick={() => setSecret("")}>{t("Dismiss")}</button></div>}
      {mailboxPassword && <div role="status"><p>{t("Copy this mailbox password now. It is shown once. Sign in using the mailbox address and Mailbox account type, not a platform account.")}</p><input aria-label={t("New mailbox Web password")} type="password" className="input mono" value={mailboxPassword} readOnly autoComplete="off" spellCheck={false} /><button className="btn ghost" type="button" onClick={() => navigator.clipboard.writeText(mailboxPassword)}>{t("Copy")}</button><button className="btn ghost" type="button" onClick={() => setMailboxPassword("")}>{t("Dismiss")}</button></div>}
    </div>
    {!loading && !error && state !== "revoked" && <div className="form-foot">
      {state !== "active" && <ActionButton className="btn primary" onAction={() => update("active")}>{t("Enable mail")}</ActionButton>}
      {state === "active" && <ActionButton confirm={t("Suspend mail and revoke all existing mail credentials?")} onAction={() => update("suspended")}>{t("Suspend mail")}</ActionButton>}
      {data && <ActionButton className="btn danger" confirm={t("Permanently revoke this mail binding? It cannot be reactivated and retained mail will not transfer to a new owner.")} onAction={() => update("revoked")}>{t("Revoke mail")}</ActionButton>}
    </div>}
  </section>;
}
