"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AppDomain,
  ConsoleAppDetail,
  ImageInventory,
  ObservabilityMetricsSummary,
  ObservabilityRequests,
  RuntimeLogs,
  BuildLogs,
  AppEnv,
} from "@/lib/fugue/console";
import { fmtBytes, fmtDate, fmtMillicores } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import {
  ActionButton,
  callConsole,
  ConfirmDialog,
  EmptyState,
  RefreshButton,
  TabError,
  TabLoading,
  useEndpointData,
} from "./shared";

const APP = (id: string) => `/apps/${encodeURIComponent(id)}`;

/* ============================ Route tab ============================ */

export function RouteTab({ app }: { app: ConsoleAppDetail }) {
  const t = useT();
  const router = useRouter();
  const route = app.route ?? {};
  const [hostname, setHostname] = useState(route.hostname ?? "");
  const [pathPrefix, setPathPrefix] = useState(route.path_prefix ?? "");
  const publicUrl = route.public_url || (route.hostname ? `https://${route.hostname}` : "");

  const domains = useEndpointData<AppDomain[]>(
    `/api/console/apps/${encodeURIComponent(app.id)}/domains`,
  );
  const [newDomain, setNewDomain] = useState("");

  return (
    <>
      <div className="panel">
        <div className="panel-h">
          <h3>{t("Primary route")}</h3>
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
              <a href={publicUrl} target="_blank" rel="noreferrer" className="mono">
                {publicUrl.replace(/^https?:\/\//, "")}
              </a>
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
              <table className="tbl">
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
                    <tr key={d.hostname}>
                      <td className="mono">{d.hostname}</td>
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
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="form-foot">
              <input
                className="input mono"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="new.example.com"
                style={{ maxWidth: 280 }}
              />
              <ActionButton
                className="btn"
                onAction={async () => {
                  if (!newDomain.trim()) throw new Error(t("Please enter a domain"));
                  await callConsole(`${APP(app.id)}/domains`, {
                    body: { hostname: newDomain.trim() },
                  });
                }}
                onDone={() => {
                  setNewDomain("");
                  domains.refresh();
                }}
              >
                {t("Add domain")}
              </ActionButton>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ========================= Environment tab ========================= */

type EnvRow = { id: number; key: string; value: string };

export function EnvTab({ app }: { app: ConsoleAppDetail }) {
  const t = useT();
  const url = `/api/console/apps/${encodeURIComponent(app.id)}/env`;
  const state = useEndpointData<AppEnv>(url);
  const [rows, setRows] = useState<EnvRow[] | null>(null);
  const [saved, setSaved] = useState(false);
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
    const set: Record<string, string> = {};
    for (const r of current) {
      if (r.key.trim()) set[r.key.trim()] = r.value;
    }
    const del = Object.keys(original).filter((k) => !(k in set));
    await callConsole(url, { method: "PATCH", body: { set, delete: del } });
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
              state.refresh();
            }}
          />
        </div>
      </div>
      {saved && <div className="wb-alert ok">{t("Environment variables saved. They take effect on the next deploy.")}</div>}
      <div className="kvedit">
        {current.length === 0 && <EmptyState message={t("No environment variables")} />}
        {current.map((r) => (
          <div className="kvedit-row" key={r.id}>
            <input
              className="input mono"
              value={r.key}
              placeholder="KEY"
              onChange={(e) => update(r.id, { key: e.target.value })}
            />
            <input
              className="input mono"
              value={r.value}
              placeholder="value"
              onChange={(e) => update(r.id, { value: e.target.value })}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label={t("Delete")}
              onClick={() => remove(r.id)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <div className="form-foot">
        <button type="button" className="btn ghost" onClick={add}>
          {t("+ Add variable")}
        </button>
        <div className="toolbar-sp" />
        <ActionButton className="btn primary" onAction={save} onDone={() => setSaved(true)}>
          {t("Save")}
        </ActionButton>
      </div>
    </div>
  );
}

/* ============================ Logs tab ============================= */

export function LogsTab({ app }: { app: ConsoleAppDetail }) {
  const t = useT();
  const [mode, setMode] = useState<"runtime" | "build">("runtime");
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
          <div className="tabs" style={{ margin: 0 }}>
            <button
              className={`tab ${mode === "runtime" ? "active" : ""}`}
              onClick={() => setMode("runtime")}
            >
              {t("Runtime")}
            </button>
            <button
              className={`tab ${mode === "build" ? "active" : ""}`}
              onClick={() => setMode("build")}
            >
              {t("Build")}
            </button>
          </div>
          <RefreshButton onClick={active.refresh} />
        </div>
      </div>
      {active.loading && <TabLoading />}
      {active.error && <TabError message={active.error} />}
      {!active.loading && !active.error && (
        <div style={{ padding: 14 }}>
          {logs ? <pre className="logbox">{logs}</pre> : <EmptyState message={t("No logs yet")} />}
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

export function ImagesTab({ app }: { app: ConsoleAppDetail }) {
  const t = useT();
  const base = `/api/console/apps/${encodeURIComponent(app.id)}`;
  const inv = useEndpointData<ImageInventory>(`${base}/images`);

  return (
    <div className="panel">
      <div className="panel-h">
        <h3>{t("Images")}</h3>
        <div className="tail">
          <RefreshButton onClick={inv.refresh} />
        </div>
      </div>
      {inv.loading && <TabLoading />}
      {inv.error && <TabError message={inv.error} />}
      {!inv.loading && !inv.error && (
        <>
          {(inv.data?.versions.length ?? 0) === 0 ? (
            <EmptyState message={t("No image versions")} />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("Image")}</th>
                  <th>{t("Size")}</th>
                  <th>{t("Status")}</th>
                  <th>{t("Deployed")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {inv.data!.versions.map((v) => (
                  <tr key={v.image_ref}>
                    <td className="mono">{v.runtime_image_ref || v.image_ref}</td>
                    <td>{fmtBytes(v.size_bytes ?? 0)}</td>
                    <td>
                      {v.current ? (
                        <span className="chip ok">{t("Current")}</span>
                      ) : (
                        <span className="chip idle">{v.status || t("Saved")}</span>
                      )}
                    </td>
                    <td>{fmtDate(v.last_deployed_at)}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {!v.current && v.redeploy_supported && (
                        <ActionButton
                          className="btn ghost"
                          confirm={t("Redeploy this image?")}
                          onAction={() =>
                            callConsole(`${APP(app.id)}/images/redeploy`, {
                              body: { image_ref: v.image_ref },
                            })
                          }
                          onDone={inv.refresh}
                        >
                          {t("Redeploy")}
                        </ActionButton>
                      )}{" "}
                      {!v.current && v.delete_supported && (
                        <ActionButton
                          className="btn danger"
                          confirm={t("Delete this image version? This cannot be undone.")}
                          onAction={() =>
                            callConsole(`${APP(app.id)}/images/delete`, {
                              body: { image_ref: v.image_ref },
                            })
                          }
                          onDone={inv.refresh}
                        >
                          {t("Delete")}
                        </ActionButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

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
            <div className="kpi-row" style={{ margin: 14, gridTemplateColumns: "repeat(4,1fr)" }}>
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
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("Request")}</th>
                  <th>{t("Status")}</th>
                  <th>{t("Duration")}</th>
                  <th>Trace</th>
                </tr>
              </thead>
              <tbody>
                {requests.data!.requests.map((r, i) => (
                  <tr key={r.request_id || r.trace_id || i}>
                    <td className="mono">
                      {(r.method || "").toUpperCase()} {r.route || "—"}
                    </td>
                    <td>
                      <span
                        className={`chip ${(r.status_code ?? 0) >= 500 ? "err" : "ok"}`}
                      >
                        {r.status_code ?? "—"}
                      </span>
                    </td>
                    <td>{r.duration_ms != null ? `${r.duration_ms} ms` : "—"}</td>
                    <td className="mono">{r.trace_id || "—"}</td>
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
