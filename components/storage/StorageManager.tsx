"use client";

import { useCallback, useEffect, useState } from "react";
import type { ObjectStore, ObjectStorageCredential, ObjectStoreProvider } from "@/lib/fugue/console";
import { useI18n } from "@/lib/i18n/client";
import { fmtBytes } from "@/lib/format";
import Modal from "@/components/ui/Modal";
import RowActions from "@/components/ui/RowActions";
import { ConfirmDialog } from "@/components/workbench/shared";
import "./storage.css";

type Choice = { id: string; name: string; project_id?: string };
type Inventory = { stores: ObjectStore[]; projects: Choice[]; apps: Choice[] };

async function api<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.result;
}

export default function StorageManager() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<Inventory>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [projectFilter, setProjectFilter] = useState("");
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("");
  const [provider, setProvider] = useState<ObjectStoreProvider>("cloudflare-r2");
  const [name, setName] = useState("");
  const [selected, setSelected] = useState("");
  const [credentials, setCredentials] = useState<{ id: string; data?: ObjectStorageCredential[]; error?: string }>();
  const [app, setApp] = useState("");
  const [grantName, setGrantName] = useState("");
  const [permission, setPermission] = useState("read-only");
  const [confirmation, setConfirmation] = useState<{ body: Record<string, unknown>; description: string; label: string }>();

  const reload = useCallback(async (signal?: AbortSignal) => {
    const inventory = await api<Inventory>("/api/console/storage", undefined, signal);
    setData(inventory);
    setProject((value) => inventory.projects.some((entry) => entry.id === value) ? value : inventory.projects[0]?.id ?? "");
  }, []);

  async function refresh() {
    setError("");
    setLoading(true);
    try { await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : t("Request failed")); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const controller = new AbortController();
    reload(controller.signal).catch((e: Error) => {
      if (!controller.signal.aborted) setError(e.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setCredentials({ id: selected });
    api<{ credentials: ObjectStorageCredential[] }>(`/api/console/storage?id=${encodeURIComponent(selected)}`, undefined, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setCredentials({ id: selected, data: result.credentials }); })
      .catch((e: Error) => { if (!controller.signal.aborted) setCredentials({ id: selected, error: e.message }); });
    return () => controller.abort();
  }, [selected, data]);

  async function mutate(body: Record<string, unknown>) {
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/api/console/storage", body);
      setNotice(t("Storage updated."));
      await reload().catch(() => setError(locale === "zh-CN" ? "变更已保存，但清单刷新失败。" : "Change saved, but the list could not be refreshed."));
    } finally { setBusy(false); }
  }

  function onError(e: unknown) { setError(e instanceof Error ? e.message : t("Request failed")); }
  const current = data?.stores.find((s) => s.id === selected);
  const projects = data?.projects ?? [];
  const projectName = (id?: string) => projects.find((p) => p.id === id)?.name || id;
  const appName = (id: string) => data?.apps.find((entry) => entry.id === id)?.name || id;
  const visibleStores = data?.stores.filter((s) => (!projectFilter || s.project_id === projectFilter) && s.name.toLowerCase().includes(query.trim().toLowerCase())) ?? [];
  const bin = (en: string, zh: string) => locale === "zh-CN" ? zh : en;
  const measuredAt = (value?: string) => value ? new Date(value).toLocaleString(locale) : "";
  const currentCredentials = credentials?.id === current?.id ? credentials : undefined;
  const stale = (value?: string) => Boolean(value && Date.now() - Date.parse(value) > 86_400_000);
  const controls = (error && <p className="storage-alert" role="alert">{error}</p>);

  return <div className="page storage-page">
    <div className="phead">
      <h1>{t("Object storage")}</h1>
      <div className="actions">
        <button type="button" className="btn ghost" disabled={loading || busy} onClick={() => void refresh()}>{t("Refresh list")}</button>
        <button type="button" className="btn primary" onClick={() => { setError(""); setCreating(true); }}>{t("Create private bucket")}</button>
      </div>
    </div>
    {!creating && controls}
    {notice && <p role="status">{notice}</p>}

    {!current && <>
      <div className="storage-create storage-filters">
        <label>{t("Filter by project")}<select className="input" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
          <option value="">{t("All projects")}</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select></label>
        <label>{bin("Search buckets", "搜索桶")}<input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      </div>
      {loading && !data ? <p role="status">{t("Loading…")}</p> : data && (
        visibleStores.length ? <ul className="storage-list">
          {visibleStores.map((s) => <li key={s.id}>
            <button type="button" onClick={() => { setSelected(s.id); setApp(""); setGrantName(""); setPermission("read-only"); setError(""); }}>
              <strong>{s.name}</strong>
              <span>{t(s.status === "active" ? "Enabled" : "Disabled")}</span>
              <small>{projectName(s.project_id)} · {s.provider === "backblaze-b2" ? "Backblaze B2" : "Cloudflare R2"}</small>
              <small>{s.usage_measured_at ? fmtBytes(s.used_bytes) : t("Not measured")}
                {stale(s.usage_measured_at) && ` · ${t("Stale measurement")}`}
              </small>
            </button>
          </li>)}
        </ul> : <p className="empty">{query || projectFilter ? bin("No buckets match the filter.", "没有匹配的桶。") : t("No object storage enabled yet.")}</p>
      )}
    </>}

    {current && <section className="storage-detail">
      <button type="button" className="btn ghost" onClick={() => { setSelected(""); setError(""); }}>{bin("Back to buckets", "返回桶清单")}</button>
      <div className="storage-detail-head intent-row">
        <h2>{current.name}</h2>
        <button type="button" className="btn" disabled={busy} onClick={() => void mutate({ action: "measure", id: current.id }).catch(onError)}>{t("Measure usage")}</button>
        <RowActions><button type="button" className="btn" disabled={busy} onClick={() => {
          const enabled = current.status === "disabled";
          setConfirmation({ body: { action: "update", id: current.id, enabled },
            description: `${current.name} — ${enabled ? bin("Enable access to this bucket?", "启用此桶的访问？") : t("Revoke all bucket credentials? Objects will be retained.")}`,
            label: enabled ? t("Enable") : t("Disable access") });
        }}>{current.status === "disabled" ? t("Enable") : t("Disable access")}</button></RowActions>
      </div>
      <dl>
        <dt>{t("Status")}</dt><dd>{t(current.status === "active" ? "Enabled" : "Disabled")}</dd>
        <dt>{bin("Endpoint", "端点")}</dt><dd>{current.endpoint}</dd>
        <dt>{t("Bucket")}</dt><dd>{current.bucket}</dd>
        <dt>{t("Storage budget")}</dt><dd>{current.quota_bytes ? fmtBytes(current.quota_bytes) : t("Not set")} · {t("Soft budget")}</dd>
        <dt>{t("Measured usage")}</dt><dd>{current.usage_measured_at ? `${fmtBytes(current.used_bytes)} · ${current.object_count ?? "—"} ${t(current.provider === "backblaze-b2" ? "object versions" : "objects")} · ${measuredAt(current.usage_measured_at)}` : t("Not measured")}
          {stale(current.usage_measured_at) && ` · ${t("Stale measurement")}`}</dd>
      </dl>
      <h3>{t("Application credentials")}</h3>
      <p className="form-hint">{t("Each credential grants access to this bucket only. Binding writes S3 environment variables to the selected app.")}</p>
      <form className="storage-create" onSubmit={(e) => {
        e.preventDefault();
        void mutate({ action: "bind", id: current.id, app_id: app, name: grantName, permission }).then(() => { setApp(""); setGrantName(""); }).catch(onError);
      }}>
        <label>{t("Application")}<select className="input" value={app} onChange={(e) => setApp(e.target.value)} required>
          <option value="">{t("Select application")}</option>
          {data?.apps.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.project_id !== current.project_id ? ` · ${projectName(entry.project_id) ?? "—"}` : ""}</option>)}
        </select></label>
        <label>{t("Credential name")}<input className="input" value={grantName} onChange={(e) => setGrantName(e.target.value)} pattern={"[a-z0-9][a-z0-9\\-]{0,47}"} required /></label>
        <label>{t("Permission")}<select className="input" value={permission} onChange={(e) => setPermission(e.target.value)}>
          <option value="read-only">{t("Read only")}</option><option value="read-write">{t("Read and write")}</option>
        </select></label>
        <button type="submit" className="btn primary" disabled={busy || current.status !== "active"}>{t("Bind to application")}</button>
      </form>
      {currentCredentials?.error ? <p role="alert">{currentCredentials.error}</p> : !currentCredentials?.data ? <p role="status">{t("Loading…")}</p> :
        <div className="storage-credentials">
          {currentCredentials.data.length === 0 && <p className="muted">{t("No credentials issued.")}</p>}
          {currentCredentials.data.map((c) => <div key={c.id} className="intent-row">
            <span><strong>{c.name}</strong><small>{appName(c.app_id)} · {c.permission} · {c.status}</small></span>
            {c.status !== "revoked" && <button type="button" className="btn ghost intent-action" disabled={busy} onClick={() => setConfirmation({
              body: { action: "revoke", id: current.id, credential_id: c.id },
              description: `${current.name} / ${appName(c.app_id)} — ${t("Revoke this credential? The application will lose bucket access.")}`,
              label: t("Revoke"),
            })}>{t("Revoke")}</button>}
          </div>)}
        </div>}
    </section>}

    {creating && <Modal title={t("Create private bucket")} onDismiss={() => setCreating(false)} dismissDisabled={busy}>
      <form onSubmit={(e) => {
        e.preventDefault();
        void mutate({ action: "create", project_id: project, name, provider }).then(() => { setName(""); setCreating(false); }).catch(onError);
      }}>
        <div className="modal-h"><h3>{t("Create private bucket")}</h3></div>
        <div className="modal-b storage-create">
          <label>{t("New bucket project")}<select className="input" value={project} onChange={(e) => setProject(e.target.value)} required>
            <option value="" disabled>{t("Select project")}</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
          <label>{t("Storage provider")}<select className="input" value={provider} onChange={(e) => setProvider(e.target.value === "backblaze-b2" ? "backblaze-b2" : "cloudflare-r2")}>
            <option value="cloudflare-r2">Cloudflare R2</option><option value="backblaze-b2">Backblaze B2</option>
          </select></label>
          <label>{t("Bucket name")}<input className="input" value={name} onChange={(e) => setName(e.target.value)} pattern={"[a-z0-9][a-z0-9\\-]{0,47}"} required /></label>
          {controls}
        </div>
        <div className="modal-f">
          <button type="button" className="btn ghost" disabled={busy} onClick={() => setCreating(false)}>{t("Cancel")}</button>
          <button type="submit" className="btn primary" disabled={busy || !project}>{t("Create private bucket")}</button>
        </div>
      </form>
    </Modal>}

    {confirmation && <ConfirmDialog title={confirmation.label} body={<p>{confirmation.description}</p>} confirmLabel={confirmation.label}
      danger={confirmation.body.enabled !== true} onCancel={() => setConfirmation(undefined)} onConfirm={async () => {
        await mutate(confirmation.body);
        setConfirmation(undefined);
      }} />}
  </div>;
}
