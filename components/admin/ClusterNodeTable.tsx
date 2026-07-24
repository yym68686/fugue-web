"use client";

import { Fragment, useState } from "react";

import type { ClusterNode, ClusterNodeWorkload } from "@/lib/fugue/console";
import { fmtBytes, fmtMillicores, fmtPercent } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import type { TranslateFn } from "@/lib/i18n/translate";

const STATUS_CHIP: Record<string, string> = {
  ready: "ok",
  active: "ok",
  drain: "warn",
  draining: "warn",
  down: "err",
  notready: "err",
  unknown: "warn",
};

function statusChipClass(status: string): string {
  return STATUS_CHIP[status.toLowerCase().replace(/\s+/g, "")] ?? "idle";
}

function barClass(pct: number | undefined): string {
  const v = pct ?? 0;
  if (v >= 85) return "crit";
  if (v >= 70) return "hot";
  return "";
}

type RoleChip = { label: string; tone: string };

/**
 * Derive display role chips for a node. Prefers the authoritative policy flags
 * (effective_edge / effective_dns / effective_control_plane_role), which the
 * backend only fills in for platform admins, and falls back to the raw
 * node-role labels so we never show an empty roles cell.
 */
function roleChips(node: ClusterNode, t: TranslateFn): RoleChip[] {
  const chips: RoleChip[] = [];
  const policy = node.policy;

  if (policy?.effective_control_plane_role) {
    chips.push({ label: t("Control plane"), tone: "run" });
  }
  if (policy?.effective_edge) {
    chips.push({ label: t("Edge"), tone: "warn" });
  }
  if (policy?.effective_dns) {
    chips.push({ label: t("DNS"), tone: "ok" });
  }
  if (policy?.effective_app_runtime) {
    chips.push({ label: t("App runtime"), tone: "idle" });
  }

  if (chips.length > 0) return chips;

  // Fallback: raw k8s roles. Map well-known names to a friendlier label/tone.
  const raw = node.roles ?? [];
  for (const role of raw) {
    const norm = role.toLowerCase();
    if (norm.includes("control-plane") || norm.includes("master")) {
      chips.push({ label: t("Control plane"), tone: "run" });
    } else if (norm.includes("edge")) {
      chips.push({ label: t("Edge"), tone: "warn" });
    } else if (norm.includes("dns")) {
      chips.push({ label: t("DNS"), tone: "ok" });
    } else {
      chips.push({ label: role, tone: "idle" });
    }
  }
  if (chips.length === 0) chips.push({ label: t("Worker"), tone: "idle" });
  return chips;
}

function UsageCell({
  usagePct,
  requestPct,
  detail,
  t,
}: {
  usagePct: number | undefined;
  requestPct: number | undefined;
  detail: string;
  t: TranslateFn;
}) {
  const usage = Math.max(0, Math.min(100, usagePct ?? 0));
  const request = Math.max(0, Math.min(100, requestPct ?? 0));
  return (
    <div className="usage-cell">
      <span className="bar bar-wide">
        <i className={barClass(usagePct)} style={{ width: `${usage}%` }}></i>
        {requestPct != null && (
          <span
            className="req-mark"
            style={{ left: `${request}%` }}
            title={t("Requested {pct}", { pct: fmtPercent(requestPct) })}
          ></span>
        )}
      </span>
      <span className="usage-meta">
        <span className="bar-val">{fmtPercent(usagePct)}</span>
        {requestPct != null && (
          <span className="usage-req">
            {t("Requested {pct}", { pct: fmtPercent(requestPct) })}
          </span>
        )}
        {detail && <span className="usage-detail">{detail}</span>}
      </span>
    </div>
  );
}

function workloadLabel(w: ClusterNodeWorkload, t: TranslateFn): string {
  if (w.kind === "backing_service") {
    return w.service_type ? t("Service · {type}", { type: w.service_type }) : t("Service");
  }
  return t("App");
}

/** Expanded detail: node addresses + the workloads scheduled on it. */
function NodeDetail({ node, t }: { node: ClusterNode; t: TranslateFn }) {
  const workloads = node.workloads ?? [];
  return (
    <div className="node-detail">
      <div className="node-detail-grid">
        <div className="node-detail-item">
          <span className="node-detail-k">{t("Public IP")}</span>
          <span className="node-detail-v mono">{node.public_ip || "—"}</span>
        </div>
        <div className="node-detail-item">
          <span className="node-detail-k">{t("Internal IP")}</span>
          <span className="node-detail-v mono">{node.internal_ip || "—"}</span>
        </div>
        {node.external_ip && node.external_ip !== node.public_ip && (
          <div className="node-detail-item">
            <span className="node-detail-k">{t("External IP")}</span>
            <span className="node-detail-v mono">{node.external_ip}</span>
          </div>
        )}
        {node.kubelet_version && (
          <div className="node-detail-item">
            <span className="node-detail-k">{t("Kubelet")}</span>
            <span className="node-detail-v mono">{node.kubelet_version}</span>
          </div>
        )}
        {node.os_image && (
          <div className="node-detail-item">
            <span className="node-detail-k">{t("OS")}</span>
            <span className="node-detail-v">{node.os_image}</span>
          </div>
        )}
      </div>

      <div className="node-detail-workloads">
        <div className="node-detail-k" style={{ marginBottom: 8 }}>
          {t("Services on this node ({count})", { count: workloads.length })}
        </div>
        {workloads.length === 0 ? (
          <div className="faint">{t("No services scheduled here.")}</div>
        ) : (
          <table className="tbl tbl-sub">
            <thead>
              <tr>
                <th>{t("Workload")}</th>
                <th>{t("Type")}</th>
                <th>{t("Tenant")}</th>
                <th className="ta-r">{t("Pods")}</th>
              </tr>
            </thead>
            <tbody>
              {workloads.map((w) => (
                <tr key={`${w.kind}:${w.id}`}>
                  <td className="mono">{w.name}</td>
                  <td>{workloadLabel(w, t)}</td>
                  <td className="mono faint">{w.tenant_id || "—"}</td>
                  <td className="ta-r mono">{w.pod_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function ClusterNodeTable({ nodes }: { nodes: ClusterNode[] }) {
  const t = useT();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <table className="tbl tbl-cluster">
      <thead>
        <tr>
          <th style={{ width: 28 }}></th>
          <th>{t("Node")}</th>
          <th>{t("Role")}</th>
          <th>{t("Status")}</th>
          <th>{t("CPU (usage / request)")}</th>
          <th>{t("Memory (usage / request)")}</th>
          <th>{t("Disk")}</th>
        </tr>
      </thead>
      <tbody>
        {nodes.map((n) => {
          const isOpen = expanded.has(n.name);
          const workloadCount = n.workloads?.length ?? 0;
          return (
            <Fragment key={n.name}>
              <tr
                className={`row-toggle${isOpen ? " open" : ""}`}
                onClick={() => toggle(n.name)}
              >
                <td>
                  <button
                    type="button"
                    className="caret-btn"
                    aria-expanded={isOpen}
                    aria-label={isOpen ? t("Collapse") : t("Expand")}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(n.name);
                    }}
                  >
                    <span className={`caret${isOpen ? " down" : ""}`}>▶</span>
                  </button>
                </td>
                <td>
                  <div className="node-nm">{n.name}</div>
                  <div className="node-sub">
                    {n.region || t("Unknown region")}
                    {workloadCount > 0 && (
                      <> · {t("{count} services", { count: workloadCount })}</>
                    )}
                  </div>
                </td>
                <td>
                  <div className="role-chips">
                    {roleChips(n, t).map((c, i) => (
                      <span key={i} className={`chip ${c.tone}`}>
                        {c.label}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <span className={`chip ${statusChipClass(n.status)}`}>{n.status}</span>
                </td>
                <td>
                  <UsageCell
                    t={t}
                    usagePct={n.cpu?.usage_percent}
                    requestPct={n.cpu?.request_percent}
                    detail={
                      n.cpu?.capacity_millicores
                        ? `${fmtMillicores(n.cpu.used_millicores)} / ${fmtMillicores(n.cpu.capacity_millicores)}`
                        : ""
                    }
                  />
                </td>
                <td>
                  <UsageCell
                    t={t}
                    usagePct={n.memory?.usage_percent}
                    requestPct={n.memory?.request_percent}
                    detail={
                      n.memory?.capacity_bytes
                        ? `${fmtBytes(n.memory.used_bytes)} / ${fmtBytes(n.memory.capacity_bytes)}`
                        : ""
                    }
                  />
                </td>
                <td>
                  <UsageCell
                    t={t}
                    usagePct={n.ephemeral_storage?.usage_percent}
                    requestPct={undefined}
                    detail={
                      n.ephemeral_storage?.capacity_bytes
                        ? `${fmtBytes(n.ephemeral_storage.used_bytes)} / ${fmtBytes(n.ephemeral_storage.capacity_bytes)}`
                        : ""
                    }
                  />
                </td>
              </tr>
              {isOpen && (
                <tr className="row-detail">
                  <td colSpan={7}>
                    <NodeDetail node={n} t={t} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
