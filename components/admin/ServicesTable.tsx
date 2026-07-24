"use client";

import { Fragment, useMemo, useState } from "react";

import { useT } from "@/lib/i18n/client";
import type { TranslateFn } from "@/lib/i18n/translate";

import type { ServiceRow } from "@/app/admin/services/page";

function phaseTone(phase?: string): string {
  const p = (phase ?? "").toLowerCase();
  if (["running", "ready", "deployed", "active"].includes(p)) return "ok";
  if (["deploying", "building", "queued", "updating", "pending"].includes(p)) return "run";
  if (["failed", "error", "degraded"].includes(p)) return "err";
  if (["paused", "stopped", "disabled"].includes(p)) return "warn";
  return "idle";
}

/** Human label for a deploy method / source type. */
function deployLabel(method: string | null, t: TranslateFn): string {
  if (!method) return "—";
  const m = method.toLowerCase();
  const map: Record<string, string> = {
    git: t("Git"),
    image: t("Container image"),
    upload: t("Upload"),
    dockerfile: t("Dockerfile"),
    buildpacks: t("Buildpacks"),
    buildpack: t("Buildpacks"),
    compose: t("Compose"),
    nixpacks: t("Nixpacks"),
  };
  return map[m] ?? method;
}

type StatusFilter = "all" | "running" | "issues";

export default function ServicesTable({ rows }: { rows: ServiceRow[] }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === "running" && r.phase.toLowerCase() !== "running") return false;
      if (statusFilter === "issues" && r.phase.toLowerCase() === "running") return false;
      if (!q) return true;
      const hay = [
        r.name,
        r.ownerEmail ?? "",
        r.nodeName ?? "",
        r.repo ?? "",
        r.deployMethod ?? "",
        ...r.stack,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, statusFilter]);

  const segs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: t("All") },
    { key: "running", label: t("Running") },
    { key: "issues", label: t("Issues") },
  ];

  return (
    <>
      <div className="toolbar">
        <input
          className="input"
          type="search"
          placeholder={t("Filter by name, owner, node, stack…")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: 340 }}
        />
        <div className="seg toolbar-sp">
          {segs.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`seg-btn${statusFilter === s.key ? " active" : ""}`}
              onClick={() => setStatusFilter(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <table className="tbl tbl-services">
        <thead>
          <tr>
            <th style={{ width: 28 }}></th>
            <th>{t("Service")}</th>
            <th>{t("Owner")}</th>
            <th>{t("Status")}</th>
            <th>{t("Tech stack")}</th>
            <th>{t("Deploy method")}</th>
            <th>{t("Node")}</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => {
            const isOpen = expanded.has(r.id);
            return (
              <Fragment key={r.id}>
                <tr
                  className={`row-toggle${isOpen ? " open" : ""}`}
                  onClick={() => toggle(r.id)}
                >
                  <td>
                    <button
                      type="button"
                      className="caret-btn"
                      aria-expanded={isOpen}
                      aria-label={isOpen ? t("Collapse") : t("Expand")}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(r.id);
                      }}
                    >
                      <span className={`caret${isOpen ? " down" : ""}`}>▶</span>
                    </button>
                  </td>
                  <td>
                    <div className="node-nm">{r.name}</div>
                    {r.routeUrl && (
                      <div className="node-sub mono">
                        {r.routeUrl.replace(/^https?:\/\//, "")}
                      </div>
                    )}
                  </td>
                  <td>
                    {r.ownerEmail ? (
                      <span className="mono">{r.ownerEmail}</span>
                    ) : (
                      <span className="faint mono">{r.tenantId || "—"}</span>
                    )}
                  </td>
                  <td>
                    <span className={`chip ${phaseTone(r.phase)}`}>{r.phase}</span>
                    {r.replicas != null && (
                      <span className="faint" style={{ marginLeft: 6 }}>
                        ×{r.replicas}
                      </span>
                    )}
                  </td>
                  <td>
                    {r.stack.length > 0 ? (
                      <div className="role-chips">
                        {r.stack.slice(0, 3).map((s, i) => (
                          <span key={i} className="chip idle">
                            {s}
                          </span>
                        ))}
                        {r.stack.length > 3 && (
                          <span className="faint">+{r.stack.length - 3}</span>
                        )}
                      </div>
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                  <td>{deployLabel(r.deployMethod, t)}</td>
                  <td>
                    {r.nodeName ? (
                      <span className="mono">{r.nodeName}</span>
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="row-detail">
                    <td colSpan={7}>
                      <div className="node-detail">
                        <div className="node-detail-grid">
                          <div className="node-detail-item">
                            <span className="node-detail-k">{t("Source")}</span>
                            <span className="node-detail-v mono">{r.repo || "—"}</span>
                          </div>
                          <div className="node-detail-item">
                            <span className="node-detail-k">{t("Deploy method")}</span>
                            <span className="node-detail-v">
                              {deployLabel(r.deployMethod, t)}
                            </span>
                          </div>
                          {r.routeUrl && (
                            <div className="node-detail-item">
                              <span className="node-detail-k">{t("URL")}</span>
                              <a
                                className="node-detail-v mono"
                                href={r.routeUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {r.routeUrl}
                              </a>
                            </div>
                          )}
                          <div className="node-detail-item">
                            <span className="node-detail-k">{t("Node")}</span>
                            <span className="node-detail-v mono">{r.nodeName || "—"}</span>
                          </div>
                          <div className="node-detail-item">
                            <span className="node-detail-k">{t("Tenant")}</span>
                            <span className="node-detail-v mono faint">
                              {r.tenantId || "—"}
                            </span>
                          </div>
                          <div className="node-detail-item">
                            <span className="node-detail-k">{t("Service ID")}</span>
                            <span className="node-detail-v mono faint">{r.id}</span>
                          </div>
                        </div>
                        {r.stack.length > 0 && (
                          <div className="node-detail-workloads">
                            <div className="node-detail-k" style={{ marginBottom: 8 }}>
                              {t("Tech stack")}
                            </div>
                            <div className="role-chips">
                              {r.stack.map((s, i) => (
                                <span key={i} className="chip idle">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="faint" style={{ textAlign: "center", padding: 24 }}>
                {t("No services match the filter.")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
