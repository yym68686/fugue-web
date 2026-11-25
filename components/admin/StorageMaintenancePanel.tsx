"use client";

import { useCallback, useEffect, useState } from "react";
import type { StorageMaintenanceJob } from "@/lib/fugue/console";
import { useI18n } from "@/lib/i18n/client";
import { ConfirmDialog } from "@/components/workbench/shared";

const kinds = ["longhorn-reconcile", "retention", "backup-cleanup", "data-gc", "transfer-expiry"] as const;
type Kind = typeof kinds[number];
const labels: Record<StorageMaintenanceJob["kind"] | StorageMaintenanceJob["status"], [string, string]> = {
  "longhorn-reconcile": ["Reconcile Longhorn backups", "Longhorn 备份对账"],
  retention: ["Check backup retention", "检查备份保留策略"],
  "backup-cleanup": ["Check backup cleanup", "检查备份清理"],
  "data-gc": ["Reclaim unused data", "回收未引用数据"],
  "transfer-expiry": ["Expire idle transfers", "清理过期传输"],
  "workspace-retire": ["Retire workspace", "退役工作区"],
  queued: ["Queued", "排队中"], running: ["Running", "运行中"], retrying: ["Waiting to retry", "等待重试"],
  succeeded: ["Completed", "已完成"], failed: ["Failed", "失败"],
};

export default function StorageMaintenancePanel() {
  const { t, locale } = useI18n();
  const [jobs, setJobs] = useState<StorageMaintenanceJob[]>([]);
  const [kind, setKind] = useState<Kind>("longhorn-reconcile");
  const [scope, setScope] = useState("");
  const [previewId, setPreviewId] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState("");
  const label = (value: keyof typeof labels) => labels[value]?.[locale === "zh-CN" ? 1 : 0] ?? value;

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/admin/storage/jobs", { cache: "no-store", signal });
      if (!response.ok) throw new Error();
      const body: { jobs: StorageMaintenanceJob[] } = await response.json();
      if (!signal?.aborted) { setJobs(body.jobs); setError(false); }
    } catch { if (!signal?.aborted) setError(true); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const timer = setInterval(() => void refresh(controller.signal), 10_000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [refresh]);

  const preview = jobs.find((job) => job.id === previewId && !job.execute && job.kind === kind && (job.scope_id ?? "") === scope.trim());
  const canExecute = preview?.status === "succeeded" && !error;
  async function submit(execute: boolean) {
    if (execute && !canExecute) throw new Error(t("Storage maintenance unavailable."));
    setBusy(true);
    setError(false);
    try {
      const response = await fetch("/api/admin/storage/jobs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, scope_id: scope.trim(), execute }),
      });
      if (!response.ok) throw new Error();
      const job: StorageMaintenanceJob = await response.json();
      setSelected(job.id);
      setPreviewId(execute ? "" : job.id);
      setConfirm(false);
      await refresh();
    } catch {
      if (execute) throw new Error(t("Storage maintenance unavailable."));
      setError(true);
    } finally { setBusy(false); }
  }
  return <section className="panel admin-storage-section">
    <p className="muted">{t("Preview first. Execution checks current references again. Longhorn shared blocks are reclaimed only by its engine.")}</p>
    <form className="admin-storage-heading" onSubmit={(event) => { event.preventDefault(); void submit(false); }}>
      <label>{t("Operation")}<select value={kind} disabled={busy} onChange={(event) => {
        setKind(event.target.value as Kind); setScope(""); setPreviewId("");
      }}>{kinds.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
      {(kind === "retention" || kind === "data-gc") && <label>{t(kind === "retention" ? "Policy ID (empty: enabled policies)" : "Workspace ID")}
        <input className="input" disabled={busy} value={scope} onChange={(event) => { setScope(event.target.value); setPreviewId(""); }} />
      </label>}
      <button className={canExecute ? "btn" : "btn primary"} type="submit" disabled={busy || (kind === "data-gc" && !scope.trim())}>{t("Queue preview")}</button>
      {canExecute && <button type="button" className="btn" disabled={busy} onClick={() => setConfirm(true)}>{t("Queue execution")}</button>}
    </form>
    {error && <p role="alert">{t("Storage maintenance unavailable.")}</p>}
    <p className="muted">{t("Disabled policies keep history unless explicitly selected. Transfers retire after 30 idle days and expired authorization. A completed inventory check is not a database recovery test.")}</p>
    {jobs.length > 0 && <div className="admin-storage-table" tabIndex={0} role="region" aria-label={t("Storage maintenance jobs")}>
      <table><thead><tr>{["Operation", "Mode", "Status", "Last update", "Details"].map((heading) => <th key={heading}>{t(heading)}</th>)}</tr></thead>
        <tbody>{jobs.map((job) => <tr key={job.id}>
          <td>{label(job.kind)}<small>{job.scope_id || t("Platform")}</small></td>
          <td>{t(job.execute ? "Execution" : "Preview")}</td>
          <td>{label(job.status)}<small>{t("Attempts")}: {job.attempts}</small></td>
          <td>{new Date(job.updated_at).toLocaleString(locale)}{job.retry_at && <small>{t("Retry at")}: {new Date(job.retry_at).toLocaleString(locale)}</small>}</td>
          <td><button type="button" className="btn" aria-expanded={selected === job.id} onClick={() => setSelected(selected === job.id ? "" : job.id)}>{t("Details")}</button>
            {selected === job.id && <pre className="storage-job-result">{JSON.stringify({ id: job.id, error: job.error, result: job.result }, null, 2)}</pre>}
          </td>
        </tr>)}</tbody>
      </table>
    </div>}
    {confirm && preview && <ConfirmDialog title={t("Queue execution")} confirmLabel={t("Queue execution")} danger onCancel={() => setConfirm(false)}
      onConfirm={() => submit(true)} body={<div>
        <p><strong>{label(kind)}</strong> · {preview.scope_id || t("Platform")}</p>
        <p>{locale === "zh-CN" ? "此操作可能删除符合清理条件的数据；服务端将重新核验当前引用。" : "This operation may remove eligible data. The server rechecks current references."}</p>
        <pre className="storage-job-result">{JSON.stringify({ id: preview.id, result: preview.result }, null, 2)}</pre>
      </div>} />}
  </section>;
}
