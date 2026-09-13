"use client";

import { Fragment, useMemo, useState } from "react";

import { useT } from "@/lib/i18n/client";
import type { TranslateFn } from "@/lib/i18n/translate";
import { isObservedReady, observedFailureSummary, observedStatusTone } from "@/lib/fugue/observed-status";
import { useObservedStatusNow } from "@/lib/fugue/use-observed-status-now";

import type { ServiceRow } from "@/app/admin/services/page";

function rowIsObservedReady(row: ServiceRow, now: number): boolean {
  return isObservedReady({
    spec: row.spec ?? { replicas: row.desiredReplicas ?? undefined },
    route: row.routeUrl ? { public_url: row.routeUrl } : null,
    status: row.storedStatus,
    observed_status: row.observedStatus,
  }, now);
}

function rowTone(row: ServiceRow, now: number): string {
  return observedStatusTone({
    spec: row.spec ?? { replicas: row.desiredReplicas ?? undefined },
    route: row.routeUrl ? { public_url: row.routeUrl } : null,
    status: row.storedStatus,
    observed_status: row.observedStatus,
  }, now);
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

export function ServicesRuntimeSummary({
  rows,
  tenantCount,
  initialObservedNow,
}: {
  rows: ServiceRow[];
  tenantCount: number;
  initialObservedNow: number;
}) {
  const t = useT();
  const now = useObservedStatusNow(initialObservedNow);
  const running = rows.filter((row) => rowIsObservedReady(row, now)).length;
  const issues = Math.max(0, rows.length - running);

  return (
    <div className="services-stats" aria-label={t("Service overview")}>
      <div className="services-stat services-stat-total">
        <span className="services-stat-label">{t("Total services")}</span>
        <strong>{rows.length}</strong>
        <span className="services-stat-note">{t("Across the platform")}</span>
      </div>
      <div className="services-stat services-stat-running">
        <span className="services-stat-label"><span className="dot ok" />{t("Running")}</span>
        <strong>{running}</strong>
        <span className="services-stat-note">{t("of {total} services", { total: rows.length })}</span>
      </div>
      <div className="services-stat services-stat-issues">
        <span className="services-stat-label"><span className={`dot ${issues ? "err" : "ok"}`} />{t("Issues")}</span>
        <strong>{issues}</strong>
        <span className="services-stat-note">{issues ? t("Need attention") : t("Everything looks good")}</span>
      </div>
      <div className="services-stat">
        <span className="services-stat-label">{t("Tenants")}</span>
        <strong>{tenantCount}</strong>
        <span className="services-stat-note">{t("Active workspaces")}</span>
      </div>
    </div>
  );
}

export default function ServicesTable({
  rows,
  initialObservedNow,
}: {
  rows: ServiceRow[];
  initialObservedNow: number;
}) {
  const t = useT();
  const now = useObservedStatusNow(initialObservedNow);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [nodeFilter, setNodeFilter] = useState("");
  const [stackFilter, setStackFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filterOptions = useMemo(() => ({
    owners: [...new Set(rows.map((r) => r.ownerEmail).filter((x): x is string => Boolean(x)))].sort(),
    nodes: [...new Set(rows.map((r) => r.nodeName).filter((x): x is string => Boolean(x)))].sort(),
    stacks: [...new Set(rows.flatMap((r) => r.stack))].sort(),
  }), [rows]);

  const activeFilterCount = [statusFilter !== "all" ? statusFilter : "", ownerFilter, nodeFilter, stackFilter].filter(Boolean).length;
  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setOwnerFilter("");
    setNodeFilter("");
    setStackFilter("");
  };

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
      if (statusFilter === "running" && !rowIsObservedReady(r, now)) return false;
      if (statusFilter === "issues" && rowIsObservedReady(r, now)) return false;
      if (ownerFilter && r.ownerEmail !== ownerFilter) return false;
      if (nodeFilter && r.nodeName !== nodeFilter) return false;
      if (stackFilter && !r.stack.includes(stackFilter)) return false;
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
  }, [rows, query, statusFilter, ownerFilter, nodeFilter, stackFilter, now]);

  return (
    <>
      <div className="services-controls">
        <div className="services-list-title">
          <strong>{t("Deployed services")}</strong>
        </div>
        <label className="services-search">
          <span className="services-search-icon" aria-hidden="true">⌕</span>
          <span className="sr-only">{t("Search services")}</span>
          <input
            className="input"
            type="search"
            placeholder={t("Search by name, owner, node or stack")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && <button type="button" className="services-search-clear" onClick={() => setQuery("")} aria-label={t("Clear search")}>×</button>}
        </label>
        {(activeFilterCount > 0 || query) && (
          <button type="button" className="services-clear-filters" onClick={clearFilters}>
            {t("Clear filters")}
          </button>
        )}
      </div>

      <div className="table-scroll" role="region" aria-label={t("Services table")} tabIndex={0}>
        <table className="tbl tbl-services">
        <thead>
          <tr>
            <th style={{ width: 28 }}></th>
            <th>{t("Service")}</th>
            <th><div className="table-filter-head"><span>{t("Owner")}</span><select aria-label={t("Filter by owner")} value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}><option value="">{t("All owners")}</option>{filterOptions.owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}</select></div></th>
            <th><div className="table-filter-head"><span>{t("Status")}</span><select aria-label={t("Filter by status")} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}><option value="all">{t("All statuses")}</option><option value="running">{t("Running")}</option><option value="issues">{t("Issues")}</option></select></div></th>
            <th><div className="table-filter-head"><span>{t("Tech stack")}</span><select aria-label={t("Filter by tech stack")} value={stackFilter} onChange={(e) => setStackFilter(e.target.value)}><option value="">{t("All stacks")}</option>{filterOptions.stacks.map((stack) => <option key={stack} value={stack}>{stack}</option>)}</select></div></th>
            <th>{t("Deploy method")}</th>
            <th><div className="table-filter-head"><span>{t("Node")}</span><select aria-label={t("Filter by node")} value={nodeFilter} onChange={(e) => setNodeFilter(e.target.value)}><option value="">{t("All nodes")}</option>{filterOptions.nodes.map((node) => <option key={node} value={node}>{node}</option>)}</select></div></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => {
            const isOpen = expanded.has(r.id);
            return (
              <Fragment key={r.id}>
                <tr
                  className={`row-toggle${isOpen ? " open" : ""}`}
                  tabIndex={0}
                  aria-expanded={isOpen}
                  onClick={() => toggle(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggle(r.id);
                    }
                  }}
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
                    <span className={`chip ${rowTone(r, now)}`}>{r.phase}</span>
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
                          {observedFailureSummary({ status: r.storedStatus, observed_status: r.observedStatus }) && (
                            <div className="node-detail-item">
                              <span className="node-detail-k">{t("Last failure")}</span>
                              <span className="node-detail-v">
                                {observedFailureSummary({ status: r.storedStatus, observed_status: r.observedStatus })}
                              </span>
                            </div>
                          )}
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
      </div>
    </>
  );
}
