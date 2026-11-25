"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AppDomain,
  ConsoleAppDetail,
  ObservabilityMetricsSummary,
  ObservabilityRequests,
  RuntimeLogs,
  BuildLogs,
  AppEnv,
} from "@/lib/fugue/console";
import { fmtDate, fmtMillicores } from "@/lib/format";
import { normalizeHostname } from "@/lib/fugue/hostname";
import { useI18n, useT } from "@/lib/i18n/client";
import CodeBlock from "@/components/landing/CodeBlock";
import Icon from "@/components/ui/Icon";
import CopyValue from "@/components/ui/CopyValue";
import RowActions from "@/components/ui/RowActions";
import { isObservedReady, observedUnreadyReason } from "@/lib/fugue/observed-status";
import { unreadyReasonText } from "@/lib/fugue/unready-reason";
import {
  ActionButton,
  ConfirmDialog,
  callConsole,
  EmptyState,
  RefreshButton,
  TabError,
  TabLoading,
  useEndpointData,
} from "./shared";

const APP = (id: string) => `/apps/${encodeURIComponent(id)}`;

/* ======================= Add-domain header form ======================= */

function AddDomainForm({
  appId,
  existing,
  onAdded,
}: {
  appId: string;
  existing: readonly string[];
  onAdded: () => void;
}) {
  const t = useT();
  const [hostname, setHostname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    const normalized = normalizeHostname(hostname);

    if (!normalized) {
      setError(t("Please enter a domain"));
      return;
    }
    if (existing.includes(normalized)) {
      setError(t("This domain is already added."));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await callConsole(`${APP(appId)}/domains`, {
        body: { hostname: normalized },
      });
      setHostname("");
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Action failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="hdr-form" onSubmit={submit}>
      <input
        className="input mono"
        value={hostname}
        onChange={(e) => {
          setHostname(e.target.value);
          if (error) setError(null);
        }}
        placeholder="new.example.com"
        aria-label={t("Add domain")}
        aria-invalid={error ? true : undefined}
        autoComplete="off"
        spellCheck={false}
      />
      <button type="submit" className="btn" disabled={busy}>
        {busy ? t("Working…") : t("Add domain")}
      </button>
      {error && (
        <span className="form-hint err" role="alert">
          {error}
        </span>
      )}
    </form>
  );
}

/* ============================ Route tab ============================ */

export function RouteTab({ app, observedNow }: { app: ConsoleAppDetail; observedNow?: number }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const route = app.route ?? {};
  const [hostname, setHostname] = useState(route.hostname ?? "");
  const [pathPrefix, setPathPrefix] = useState(route.path_prefix ?? "");
  const publicUrl = route.public_url || (route.hostname ? `https://${route.hostname}` : "");
  const routeUnavailable = Boolean(publicUrl) && !isObservedReady(app, observedNow);
  const unreadyReason = unreadyReasonText(observedUnreadyReason(app), t);

  const domains = useEndpointData<AppDomain[]>(
    `/api/console/apps/${encodeURIComponent(app.id)}/domains`,
  );
  const domainHostnames = useMemo(
    () => (domains.data ?? []).map((d) => d.hostname.toLowerCase()),
    [domains.data],
  );

  return (
    <>
      {routeUnavailable && (
        <div className="panel" role="status">
          <div className="panel-h">
            <h3>{t("Route unavailable")}</h3>
          </div>
          {/* The app's last failed operation is deliberately not repeated here;
              AppFailureNotice owns it at app level. */}
          <div className="panel-note">{unreadyReason}</div>
        </div>
      )}
      <div className="panel">
        <div className="panel-h">
              <h3>{locale === "zh-CN" ? "路由配置" : "Route configuration"}</h3>
        </div>
        <div className="form">
          <div className="form-row">
            <label>{t("Hostname")}</label>
            <input
              className="input mono"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder="app.example.com"
            />
          </div>
          <div className="form-row">
            <label>{t("Path prefix")}</label>
            <input
              className="input mono"
              value={pathPrefix}
              onChange={(e) => setPathPrefix(e.target.value)}
              placeholder="/"
            />
          </div>
          {publicUrl && (
            <div className="form-row">
              <label>{t("Current address")}</label>
              {routeUnavailable
                ? <span className="mono">{publicUrl.replace(/^https?:\/\//, "")}</span>
                : <a href={publicUrl} target="_blank" rel="noreferrer" className="mono">{publicUrl.replace(/^https?:\/\//, "")}</a>}
            </div>
          )}
        </div>
        <div className="form-foot">
          <ActionButton
            className="btn primary"
            onAction={() =>
              callConsole(`${APP(app.id)}/app-route`, {
                method: "PATCH",
                body: { hostname, path_prefix: pathPrefix },
              })
            }
            onDone={() => router.refresh()}
          >
            {t("Save route")}
          </ActionButton>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h">
          <h3>{t("Custom domains")}</h3>
          <div className="tail">
            <AddDomainForm
              appId={app.id}
              existing={domainHostnames}
              onAdded={domains.refresh}
            />
            <RefreshButton onClick={domains.refresh} />
          </div>
        </div>
        {domains.loading && <TabLoading />}
        {domains.error && <TabError message={domains.error} />}
        {!domains.loading && !domains.error && (
          <>
            {(domains.data?.length ?? 0) === 0 ? (
              <EmptyState message={t("No custom domains yet")} />
            ) : (
              <div className="table-scroll" role="region" aria-label={t("Custom domains")} tabIndex={0}>
              <table className="tbl domains-table">
                <thead>
                  <tr>
                    <th>{t("Hostname")}</th>
                    <th>{t("Status")}</th>
                    <th>TLS</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {domains.data!.map((d) => (
                    <tr key={d.hostname} className="intent-row">
                      <td>
                        <CopyValue value={d.hostname} label={t("Hostname")} />
                        {d.verification_txt_name && d.verification_txt_value && <details>
                          <summary>DNS TXT</summary>
                          <CopyValue value={d.verification_txt_name} label="TXT hostname" />
                          <CopyValue value={d.verification_txt_value} label="TXT value" />
                        </details>}
                      </td>
                      <td>
                        <span className={`chip ${d.verified_at ? "ok" : "warn"}`}>
                          {d.verified_at ? t("Verified") : t("Pending verification")}
                        </span>
                      </td>
                      <td>
                        <span className={`chip ${d.tls_status === "ready" ? "ok" : "warn"}`}>
                          {d.tls_status || "pending"}
                        </span>
                      </td>
                      <td className="domain-actions">
                        <RowActions inline>
                        {!d.verified_at && (
                          <ActionButton
                            className="btn ghost"
                            onAction={() =>
                              callConsole(`${APP(app.id)}/domains/verify`, {
                                body: { hostname: d.hostname },
                              })
                            }
                            onDone={domains.refresh}
                          >
                            {t("Verify")}
                          </ActionButton>
                        )}{" "}
                        <ActionButton
                          className="btn danger"
                          confirm={t("Delete domain {hostname}?", { hostname: d.hostname })}
                          onAction={() =>
                            callConsole(
                              `${APP(app.id)}/domains?hostname=${encodeURIComponent(d.hostname)}`,
                              { method: "DELETE" },
                            )
                          }
                          onDone={domains.refresh}
                        >
                          {t("Delete")}
                        </ActionButton>
                        </RowActions>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ========================= Environment tab ========================= */

type EnvRow = { id: number; key: string; value: string };

export function EnvTab({ app }: { app: ConsoleAppDetail }) {
  const { t, locale } = useI18n();
  const url = `/api/console/apps/${encodeURIComponent(app.id)}/env`;
  const state = useEndpointData<AppEnv>(url);
  const [rows, setRows] = useState<EnvRow[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const nextId = useMemo(() => ({ n: 0 }), []);

  // Seed editable rows from fetched env once (or after refresh clears them).
  const seed = useMemo(() => {
    if (!state.data) return null;
    return Object.entries(state.data.env).map(([key, value]) => ({
      id: nextId.n++,
      key,
      value,
    }));
  }, [state.data, nextId]);

  const current = rows ?? seed ?? [];
  const original = state.data?.env ?? {};
  const next = Object.fromEntries(current.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value]));
  const added = Object.keys(next).filter((k) => !Object.hasOwn(original, k));
  const changed = Object.keys(next).filter((k) => Object.hasOwn(original, k) && next[k] !== original[k]);
  const deleted = Object.keys(original).filter((k) => !Object.hasOwn(next, k));

  function update(id: number, patch: Partial<EnvRow>) {
    setSaved(false);
    setRows(current.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function remove(id: number) {
    setSaved(false);
    setRows(current.filter((r) => r.id !== id));
  }
  function add() {
    setSaved(false);
    setRows([...current, { id: nextId.n++, key: "", value: "" }]);
  }

  async function save() {
    await callConsole(url, { method: "PATCH", body: { set: next, delete: deleted } });
    setConfirming(false);
    setRows(null);
    setRevealed(new Set());
    setSaved(true);
    state.refresh();
  }

  if (state.loading) return <TabLoading />;
  if (state.error) return <TabError message={state.error} />;

  return (
    <div className="panel">
      <div className="panel-h">
        <h3>{t("Environment variables")}</h3>
        <div className="tail">
          <RefreshButton
            onClick={() => {
              setRows(null);
              setRevealed(new Set());
              state.refresh();
            }}
          />
        </div>
      </div>
      {saved && <div className="wb-alert ok">{t("Environment variables saved. They take effect on the next deploy.")}</div>}
      <div className="kvedit">
        {current.length === 0 && <EmptyState message={t("No environment variables")} />}
        {current.map((r) => (
          <div className="kvedit-row intent-row" key={r.id}>
            <input
              className="input mono"
              aria-label={locale === "zh-CN" ? "变量名" : "Variable name"}
              value={r.key}
              placeholder="KEY"
              onChange={(e) => update(r.id, { key: e.target.value })}
            />
            <input
              className="input mono"
              type={revealed.has(r.id) ? "text" : "password"}
              aria-label={locale === "zh-CN" ? "变量值" : "Variable value"}
              autoComplete="off"
              value={r.value}
              placeholder="value"
              onChange={(e) => update(r.id, { value: e.target.value })}
            />
            <div className="env-row-actions">
            <button type="button" className="btn ghost" aria-pressed={revealed.has(r.id)} onClick={() => setRevealed((previous) => {
              const next = new Set(previous);
              if (next.has(r.id)) next.delete(r.id); else next.add(r.id);
              return next;
            })}>
              {locale === "zh-CN" ? (revealed.has(r.id) ? "隐藏" : "显示") : (revealed.has(r.id) ? "Hide" : "Show")}
            </button>
            <button
              type="button"
              className="icon-btn intent-action"
              aria-label={t("Delete")}
              onClick={() => remove(r.id)}
            >
              <Icon name="Close" />
            </button>
            </div>
          </div>
        ))}
      </div>
      <div className="form-foot">
        <button type="button" className="btn ghost" onClick={add}>
          {t("+ Add variable")}
        </button>
        <div className="toolbar-sp" />
        <button type="button" className="btn primary" disabled={!added.length && !changed.length && !deleted.length} onClick={() => setConfirming(true)}>{t("Save")}</button>
      </div>
      {confirming && <ConfirmDialog title={t("Environment variables")} confirmLabel={t("Save")} onCancel={() => setConfirming(false)} onConfirm={save} body={
        <div className="env-change-summary">
          <p>{locale === "zh-CN" ? "变更在下次部署时生效。" : "Changes take effect on the next deploy."}</p>
          {[[locale === "zh-CN" ? "新增" : "Added", added], [locale === "zh-CN" ? "修改" : "Changed", changed], [locale === "zh-CN" ? "删除" : "Removed", deleted]].map(([label, keys]) =>
            keys.length ? <p key={String(label)}>{label}: <code>{(keys as string[]).join(", ")}</code></p> : null)}
        </div>
      } />}
    </div>
  );
}

/* ============================ Logs tab ============================= */

export function LogsTab({ app }: { app: ConsoleAppDetail }) {
  const { t, locale } = useI18n();
  const [mode, setMode] = useState<"runtime" | "build">("runtime");
  const [wrap, setWrap] = useState(false);
  const base = `/api/console/apps/${encodeURIComponent(app.id)}`;
  const runtime = useEndpointData<RuntimeLogs>(
    mode === "runtime" ? `${base}/logs/runtime` : null,
  );
  const build = useEndpointData<BuildLogs>(mode === "build" ? `${base}/logs/build` : null);
  const active = mode === "runtime" ? runtime : build;
  const logs = active.data?.logs ?? "";

  return (
    <div className="panel">
      <div className="panel-h">
        <h3>{t("Logs")}</h3>
        <div className="tail" style={{ gap: 8 }}>
          <div className="inline-modes" role="group" aria-label={t("Logs")}>
            <button
              className="btn ghost"
              aria-pressed={mode === "runtime"}
              onClick={() => setMode("runtime")}
            >
              {t("Runtime")}
            </button>
            <button
              className="btn ghost"
              aria-pressed={mode === "build"}
              onClick={() => setMode("build")}
            >
              {t("Build")}
            </button>
          </div>
          <button type="button" className="btn ghost" aria-pressed={wrap} onClick={() => setWrap(!wrap)}>
            {locale === "zh-CN" ? "自动换行" : "Wrap lines"}
          </button>
          <RefreshButton onClick={active.refresh} />
        </div>
      </div>
      {active.loading && <TabLoading />}
      {active.error && <TabError message={active.error} />}
      {!active.loading && !active.error && (
        <div>
          {logs ? <pre className={`logbox${wrap ? " log-wrap" : ""}`} tabIndex={0} aria-label={t("Logs")}>{logs}</pre> : <EmptyState message={t("No logs yet")} />}
        </div>
      )}
    </div>
  );
}

/* ============================ Files tab ============================ */
// The Files tab is a full lazy-loading browser + viewer/editor; it lives in its
// own module. Kept as a thin re-export so ProjectWorkbench's import is stable.
export { default as FilesTab } from "./FilesBrowser";

/* =========================== Images tab =========================== */

// The Images tab carries a bulk-delete flow with its own progress and
// per-image failure reporting; it lives in its own module. Kept as a thin
// re-export so ProjectWorkbench's import is stable.
export { default as ImagesTab } from "./ImagesPanel";

/* ======================= Observability tab ======================== */

const WINDOWS = [
  { label: "15 minutes", value: "15m" },
  { label: "1 hour", value: "1h" },
  { label: "24 hours", value: "24h" },
];

export function ObservabilityTab({ app }: { app: ConsoleAppDetail }) {
  const t = useT();
  const [since, setSince] = useState("1h");
  const base = `/api/console/apps/${encodeURIComponent(app.id)}`;
  const metrics = useEndpointData<ObservabilityMetricsSummary>(
    `${base}/observability/metrics?since=${since}`,
  );
  const requests = useEndpointData<ObservabilityRequests>(
    `${base}/observability/requests?since=${since}`,
  );
  const source = metrics.data?.source;

  return (
    <>
      <div className="toolbar">
        <div className="tabs" style={{ margin: 0 }}>
          {WINDOWS.map((w) => (
            <button
              key={w.value}
              className={`tab ${since === w.value ? "active" : ""}`}
              onClick={() => setSince(w.value)}
            >
              {t(w.label)}
            </button>
          ))}
        </div>
        {source && (
          <span className={`chip ${source.available ? "ok" : "warn"}`}>
            {source.status || (source.available ? "available" : "disabled")}
          </span>
        )}
        <div className="toolbar-sp" />
        <RefreshButton
          onClick={() => {
            metrics.refresh();
            requests.refresh();
          }}
        />
      </div>

      <div className="panel">
        <div className="panel-h">
          <h3>{t("Metrics")}</h3>
        </div>
        {metrics.loading && <TabLoading />}
        {metrics.error && <TabError message={metrics.error} />}
        {!metrics.loading && !metrics.error && (
          (metrics.data?.metrics.length ?? 0) === 0 ? (
            <EmptyState message={t("No metrics yet")} />
          ) : (
            <div className="kpi-row">
              {metrics.data!.metrics.slice(0, 8).map((m) => (
                <div className="kpi" key={m.name}>
                  <div className="k">{m.name}</div>
                  <div className="v">
                    {m.value}
                    {m.unit && <small> {m.unit}</small>}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <div className="panel">
        <div className="panel-h">
          <h3>{t("Requests")}</h3>
        </div>
        {requests.loading && <TabLoading />}
        {requests.error && <TabError message={requests.error} />}
        {!requests.loading && !requests.error && (
          (requests.data?.requests.length ?? 0) === 0 ? (
            <EmptyState message={t("No requests yet")} />
          ) : (
            <table className="tbl request-table">
              <thead>
                <tr>
                  <th>{t("Request")}</th>
                  <th>{t("Status")}</th>
                  <th>{t("Duration")}</th>
                </tr>
              </thead>
              <tbody>
                {requests.data!.requests.map((r, i) => (
                  <tr key={r.request_id || r.trace_id || i}>
                    <td className="mono">
                      <span>{(r.method || "").toUpperCase()}</span>
                      <details><summary>{r.route || "—"}</summary>
                        {r.trace_id && <CodeBlock label="Trace ID">{r.trace_id}</CodeBlock>}
                      </details>
                    </td>
                    <td>
                      <span
                        className={`chip ${r.status_code == null ? "idle" : r.status_code >= 500 ? "err" : r.status_code >= 400 ? "warn" : "ok"}`}
                      >
                        {r.status_code ?? "—"}
                      </span>
                    </td>
                    <td>{r.duration_ms != null ? `${r.duration_ms} ms` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </>
  );
}
