"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { fmtBytes, fmtDate, fmtMillicores } from "@/lib/format";
import {
  nodeHealth,
  type NodeView,
  type ServerView,
  type ServersSnapshot,
} from "@/lib/servers/model";
import { callConsole } from "@/components/workbench/shared";
import { copyText } from "@/lib/ui/clipboard";
import RuntimeAccessEditor, { PublicPrice } from "./RuntimeAccessEditor";
import NodeKeyRowActions from "./NodeKeyRowActions";

function ResourceTable({ node }: { node: NodeView }) {
  const t = useT();
  const rows = [
    {
      label: t("CPU"),
      capacity: fmtMillicores(node.cpu?.capacity_millicores),
      used: fmtMillicores(node.cpu?.used_millicores),
      requested: fmtMillicores(node.cpu?.requested_millicores),
      free: fmtMillicores(node.cpu?.schedulable_free_millicores),
    },
    {
      label: t("Memory"),
      capacity: fmtBytes(node.memory?.capacity_bytes),
      used: fmtBytes(node.memory?.used_bytes),
      requested: fmtBytes(node.memory?.requested_bytes),
      free: fmtBytes(node.memory?.schedulable_free_bytes),
    },
    {
      label: t("Disk"),
      capacity: fmtBytes(node.ephemeral_storage?.capacity_bytes),
      used: fmtBytes(node.ephemeral_storage?.used_bytes),
      requested: fmtBytes(node.ephemeral_storage?.requested_bytes),
      free: fmtBytes(node.ephemeral_storage?.schedulable_free_bytes),
    },
  ];
  return (
    <div className="server-table-scroll">
      <table className="tbl">
        <thead>
          <tr>
            {[
              "Resource",
              "Capacity",
              "Used",
              "Requested",
              "Schedulable free",
            ].map((label) => (
              <th key={label}>{t(label)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th>{r.label}</th>
              <td>{r.capacity}</td>
              <td>{r.used}</td>
              <td>{r.requested}</td>
              <td>{r.free}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ServerCard({ server, now }: { server: ServerView; now: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const { runtime: r, node } = server;
  const health = nodeHealth(node, now);
  const kind = r.owned
    ? "Your server"
    : r.kind === "internal"
      ? "Internal capacity"
      : r.kind === "public"
        ? "Public server"
        : "Shared with you";
  const facts = [
    ["Owner workspace", r.owned ? t("Your workspace") : r.tenant_id],
    [
      "Location",
      [r.country, r.location, node?.region, node?.zone]
        .filter(Boolean)
        .join(" · "),
    ],
    ["Public IP", node?.public_ip || node?.external_ip || r.endpoint],
    ["Internal IP", node?.internal_ip],
    ["Runtime", r.id],
    ["Node", r.cluster_node_name],
    ["OS", node?.os_image],
    ["Kubelet", node?.kubelet_version],
    ["Roles", node?.roles?.join(", ")],
    ["Joined", fmtDate(r.created_at)],
    ["Last heartbeat", fmtDate(r.last_heartbeat_at || r.last_seen_at)],
    ["Last observation", fmtDate(node?.observed_at)],
  ];
  return (
    <details
      className="server-card"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        <span className={`dot ${health === "ready" ? "ok" : "idle"}`} />
        <span className="server-heading">
          <strong>{r.name || r.machine_name || r.id}</strong>
          <small>
            {[r.country, node?.region, r.cluster_node_name]
              .filter(Boolean)
              .join(" · ")}
          </small>
        </span>
        <span className="chip">{t(kind)}</span>
        <span className="chip">
          {t(
            r.cluster_scope === "internal"
              ? "Internal cluster"
              : r.sharing === "public"
                ? "Public"
                : "Private",
          )}
        </span>
        <span className={`chip ${health === "ready" ? "ok" : "idle"}`}>
          {t(
            health === "ready"
              ? "Ready"
              : r.status === "offline"
                ? "Offline"
                : health === "unknown"
                  ? "Health unknown"
                  : "Not ready",
          )}
        </span>
        <span className="server-expand" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </summary>
      {open && (
        <div className="server-card-body">
          <dl className="server-facts">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt>{t(label!)}</dt>
                <dd>{value || "—"}</dd>
              </div>
            ))}
          </dl>
          <p className="form-hint">
            {t("Runtime status")}: {r.status}
          </p>
          {r.sharing === "public" && (
            <p>
              <PublicPrice offer={r.public_offer} />
            </p>
          )}
          {node ? (
            <>
              {health === "unknown" && (
                <p className="wb-alert">
                  {t(
                    "Measurements may be stale. Refresh before making placement decisions.",
                  )}
                </p>
              )}
              <ResourceTable node={node} />
              <h4>{t("Node conditions")}</h4>
              {node.conditions ? (
                <ul className="server-conditions">
                  {Object.entries(node.conditions).map(([name, c]) => (
                    <li key={name}>
                      <strong>
                        {name}: {c.status ?? "—"}
                      </strong>
                      <span>
                        {c.reason || "—"} · {c.message || "—"}
                      </span>
                      <small>{fmtDate(c.last_transition_at)}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t("Node conditions are unavailable.")}</p>
              )}
              <h4>{t("Workloads on this server")}</h4>
              {node.workloads ? (
                <div className="server-table-scroll">
                  <table className="tbl">
                    <thead>
                      <tr>
                        {["Name", "Type", "Pods"].map((s) => (
                          <th key={s}>{t(s)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {node.workloads.map((w) => (
                        <tr key={`${w.kind}:${w.id}`}>
                          <td>{w.name}</td>
                          <td>{w.service_type || w.kind}</td>
                          <td>
                            {w.pods
                              ?.map((p) => `${p.name} (${p.phase || "—"})`)
                              .join(", ") || w.pod_count}
                          </td>
                        </tr>
                      ))}
                      {!node.workloads.length && (
                        <tr>
                          <td colSpan={3}>
                            {t("No workloads on this server.")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>{t("Workload inventory is unavailable.")}</p>
              )}
            </>
          ) : (
            <p className="wb-alert">
              {t(
                r.cluster_scope === "internal" && !server.capabilities.scope
                  ? "Individual internal-node measurements are restricted to platform admins."
                  : "Node health and resource measurements are unavailable.",
              )}
            </p>
          )}
          <RuntimeAccessEditor server={server} />
        </div>
      )}
    </details>
  );
}

function CopyNodeKey({ id, available }: { id: string; available: boolean }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function copy(kind: "secret" | "joinCommand") {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const value = callConsole<{ secret: string; joinCommand: string }>(
        `/node-keys/${encodeURIComponent(id)}/secret`,
      ).then((r) => r[kind]);
      const copied = await copyText(await value);
      setMessage(t(copied ? "Copied" : "Failed to copy key. Try again."));
    } catch (err) {
      setMessage(t(err instanceof Error ? err.message : "Action failed."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="server-inline">
        <button
          className="btn sm ghost"
          disabled={!available || busy}
          onClick={() => copy("joinCommand")}
        >
          {t("Copy join command")}
        </button>
        <button
          className="btn sm ghost"
          disabled={!available || busy}
          onClick={() => copy("secret")}
        >
          {t("Copy secret")}
        </button>
      </div>
      {!available && (
        <small>
          {t("Secret unavailable or key inactive. Create a new key if needed.")}
        </small>
      )}
      {message && <small role="status">{message}</small>}
    </div>
  );
}

export default function ServersPanel({
  snapshot,
}: {
  snapshot: ServersSnapshot;
}) {
  const t = useT();
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [now, setNow] = useState(() => Date.parse(snapshot.observedAt));
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [snapshot.observedAt]);
  const servers = snapshot.servers.filter(
    ({ runtime: r, node }) =>
      (filter === "all" || (filter === "owned" ? r.owned : !r.owned)) &&
      [
        r.name,
        r.machine_name,
        r.cluster_node_name,
        r.tenant_id,
        r.country,
        r.location,
        node?.public_ip,
        node?.roles?.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <>
      <div className="server-toolbar">
        <div className="meta">
          <span>
            {t("{count} servers", { count: snapshot.servers.length })}
          </span>
          <span>
            {t("{count} ready", {
              count: snapshot.servers.filter(
                (s) => nodeHealth(s.node, now) === "ready",
              ).length,
            })}
          </span>
        </div>
        <button
          className="btn ghost"
          disabled={refreshing}
          onClick={() => startRefresh(() => router.refresh())}
        >
          {t(refreshing ? "Refreshing…" : "Refresh")}
        </button>
      </div>
      {snapshot.errors.map((e) => (
        <div className="wb-alert err" role="alert" key={e}>
          {t(e)}
        </div>
      ))}
      <div className="panel">
        <div className="panel-h server-toolbar">
          <h3>{t("Nodes")}</h3>
          <input
            className="input server-search"
            type="search"
            aria-label={t("Search servers")}
            placeholder={t("Search servers")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="input server-filter"
            aria-label={t("Server ownership")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">{t("All accessible servers")}</option>
            <option value="owned">{t("Your servers")}</option>
            <option value="shared">{t("Shared and internal servers")}</option>
          </select>
        </div>
        {servers.map((s) => (
          <ServerCard key={s.runtime.id} server={s} now={now} />
        ))}
        {!servers.length && (
          <div className="empty">{t("No matching servers.")}</div>
        )}
      </div>
      <div className="panel">
        <div className="panel-h">
          <h3>{t("Node keys")}</h3>
        </div>
        <div className="list">
          {snapshot.keys.map((k) => (
            <div className="row-item server-key-row" key={k.id}>
              <div className="main-col">
                <div className="nm">
                  {k.label}
                  <span
                    className={`chip ${k.status === "active" ? "ok" : "idle"}`}
                  >
                    {t(k.status === "active" ? "Active" : "Revoked")}
                  </span>
                </div>
                <div className="id">{k.id}</div>
                <div className="sub">
                  {t("Last used")}:{" "}
                  {k.lastUsedAt ? fmtDate(k.lastUsedAt) : t("Never used")} ·{" "}
                  {t("Connected servers")}: {k.attachedCount ?? "—"}
                </div>
              </div>
              <CopyNodeKey id={k.id} available={k.hasSecret} />
              <NodeKeyRowActions
                keyId={k.id}
                label={k.label}
                status={k.status}
              />
            </div>
          ))}
          {!snapshot.keys.length && (
            <div className="empty">{t("No node keys yet")}</div>
          )}
        </div>
      </div>
    </>
  );
}
