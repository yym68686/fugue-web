"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AppDomain,
  ConsoleAppDetail,
  FilesystemTree,
  ImageInventory,
  ObservabilityMetricsSummary,
  ObservabilityRequests,
  RuntimeLogs,
  BuildLogs,
  AppEnv,
} from "@/lib/fugue/console";
import { fmtBytes, fmtDate, fmtMillicores } from "@/lib/format";
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
          <h3>主路由</h3>
        </div>
        <div className="form">
          <div className="form-row">
            <label>主机名</label>
            <input
              className="input mono"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder="app.example.com"
            />
          </div>
          <div className="form-row">
            <label>路径前缀</label>
            <input
              className="input mono"
              value={pathPrefix}
              onChange={(e) => setPathPrefix(e.target.value)}
              placeholder="/"
            />
          </div>
          {publicUrl && (
            <div className="form-row">
              <label>当前地址</label>
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
            保存路由
          </ActionButton>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h">
          <h3>自定义域名</h3>
          <div className="tail">
            <RefreshButton onClick={domains.refresh} />
          </div>
        </div>
        {domains.loading && <TabLoading />}
        {domains.error && <TabError message={domains.error} />}
        {!domains.loading && !domains.error && (
          <>
            {(domains.data?.length ?? 0) === 0 ? (
              <EmptyState message="还没有自定义域名" />
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>主机名</th>
                    <th>状态</th>
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
                          {d.verified_at ? "已验证" : "待验证"}
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
                            验证
                          </ActionButton>
                        )}{" "}
                        <ActionButton
                          className="btn danger"
                          confirm={`确认删除域名 ${d.hostname}?`}
                          onAction={() =>
                            callConsole(
                              `${APP(app.id)}/domains?hostname=${encodeURIComponent(d.hostname)}`,
                              { method: "DELETE" },
                            )
                          }
                          onDone={domains.refresh}
                        >
                          删除
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
                  if (!newDomain.trim()) throw new Error("请输入域名");
                  await callConsole(`${APP(app.id)}/domains`, {
                    body: { hostname: newDomain.trim() },
                  });
                }}
                onDone={() => {
                  setNewDomain("");
                  domains.refresh();
                }}
              >
                添加域名
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
        <h3>环境变量</h3>
        <div className="tail">
          <RefreshButton
            onClick={() => {
              setRows(null);
              state.refresh();
            }}
          />
        </div>
      </div>
      {saved && <div className="wb-alert ok">环境变量已保存,将在下次部署生效。</div>}
      <div className="kvedit">
        {current.length === 0 && <EmptyState message="没有环境变量" />}
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
              aria-label="删除"
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
          + 添加变量
        </button>
        <div className="toolbar-sp" />
        <ActionButton className="btn primary" onAction={save} onDone={() => setSaved(true)}>
          保存
        </ActionButton>
      </div>
    </div>
  );
}

/* ============================ Logs tab ============================= */

export function LogsTab({ app }: { app: ConsoleAppDetail }) {
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
        <h3>日志</h3>
        <div className="tail" style={{ gap: 8 }}>
          <div className="tabs" style={{ margin: 0 }}>
            <button
              className={`tab ${mode === "runtime" ? "active" : ""}`}
              onClick={() => setMode("runtime")}
            >
              运行时
            </button>
            <button
              className={`tab ${mode === "build" ? "active" : ""}`}
              onClick={() => setMode("build")}
            >
              构建
            </button>
          </div>
          <RefreshButton onClick={active.refresh} />
        </div>
      </div>
      {active.loading && <TabLoading />}
      {active.error && <TabError message={active.error} />}
      {!active.loading && !active.error && (
        <div style={{ padding: 14 }}>
          {logs ? <pre className="logbox">{logs}</pre> : <EmptyState message="暂无日志" />}
        </div>
      )}
    </div>
  );
}

/* ============================ Files tab ============================ */

export function FilesTab({ app }: { app: ConsoleAppDetail }) {
  const base = `/api/console/apps/${encodeURIComponent(app.id)}`;
  const tree = useEndpointData<FilesystemTree>(`${base}/filesystem/tree`);

  return (
    <div className="panel">
      <div className="panel-h">
        <h3>文件</h3>
        <div className="tail">
          <RefreshButton onClick={tree.refresh} />
        </div>
      </div>
      {tree.loading && <TabLoading />}
      {tree.error && <TabError message={tree.error} />}
      {!tree.loading && !tree.error && (
        <>
          {tree.data && (
            <div className="wb-meta">
              <span>
                Pod <b>{tree.data.pod || "—"}</b>
              </span>
              <span>
                根目录 <b>{tree.data.workspace_root || "/"}</b>
              </span>
            </div>
          )}
          {(tree.data?.entries.length ?? 0) === 0 ? (
            <EmptyState message="没有文件" />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>路径</th>
                  <th>类型</th>
                  <th>大小</th>
                  <th>修改于</th>
                </tr>
              </thead>
              <tbody>
                {tree.data!.entries.map((e) => (
                  <tr key={e.path}>
                    <td className="mono">{e.path}</td>
                    <td>{e.kind === "directory" ? "目录" : "文件"}</td>
                    <td>{e.kind === "directory" ? "—" : fmtBytes(e.size ?? 0)}</td>
                    <td>{fmtDate(e.modified_at)}</td>
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

/* =========================== Images tab =========================== */

export function ImagesTab({ app }: { app: ConsoleAppDetail }) {
  const base = `/api/console/apps/${encodeURIComponent(app.id)}`;
  const inv = useEndpointData<ImageInventory>(`${base}/images`);

  return (
    <div className="panel">
      <div className="panel-h">
        <h3>镜像</h3>
        <div className="tail">
          <RefreshButton onClick={inv.refresh} />
        </div>
      </div>
      {inv.loading && <TabLoading />}
      {inv.error && <TabError message={inv.error} />}
      {!inv.loading && !inv.error && (
        <>
          {(inv.data?.versions.length ?? 0) === 0 ? (
            <EmptyState message="没有镜像版本" />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>镜像</th>
                  <th>大小</th>
                  <th>状态</th>
                  <th>部署于</th>
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
                        <span className="chip ok">当前</span>
                      ) : (
                        <span className="chip idle">{v.status || "已保存"}</span>
                      )}
                    </td>
                    <td>{fmtDate(v.last_deployed_at)}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {!v.current && v.redeploy_supported && (
                        <ActionButton
                          className="btn ghost"
                          confirm={`确认重新部署该镜像?`}
                          onAction={() =>
                            callConsole(`${APP(app.id)}/images/redeploy`, {
                              body: { image_ref: v.image_ref },
                            })
                          }
                          onDone={inv.refresh}
                        >
                          重部署
                        </ActionButton>
                      )}{" "}
                      {!v.current && v.delete_supported && (
                        <ActionButton
                          className="btn danger"
                          confirm={`确认删除该镜像版本?此操作不可撤销。`}
                          onAction={() =>
                            callConsole(`${APP(app.id)}/images/delete`, {
                              body: { image_ref: v.image_ref },
                            })
                          }
                          onDone={inv.refresh}
                        >
                          删除
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
  { label: "15 分钟", value: "15m" },
  { label: "1 小时", value: "1h" },
  { label: "24 小时", value: "24h" },
];

export function ObservabilityTab({ app }: { app: ConsoleAppDetail }) {
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
              {w.label}
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
          <h3>指标</h3>
        </div>
        {metrics.loading && <TabLoading />}
        {metrics.error && <TabError message={metrics.error} />}
        {!metrics.loading && !metrics.error && (
          (metrics.data?.metrics.length ?? 0) === 0 ? (
            <EmptyState message="暂无指标" />
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
          <h3>请求</h3>
        </div>
        {requests.loading && <TabLoading />}
        {requests.error && <TabError message={requests.error} />}
        {!requests.loading && !requests.error && (
          (requests.data?.requests.length ?? 0) === 0 ? (
            <EmptyState message="暂无请求" />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>请求</th>
                  <th>状态</th>
                  <th>耗时</th>
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
