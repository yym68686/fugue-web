import "server-only";
import { getAuthContext, listNodeKeys } from "@/lib/fugue/console";
import { readRuntimes, readTenantNodes } from "@/lib/fugue/runtime-management";
import type { WorkspaceAccess } from "@/lib/workspace/store";
import {
  readNodeKeyMetadata,
  syncNodeKeyMetadata,
} from "@/lib/servers/node-keys";
import {
  runtimeCapabilities,
  runtimeView,
  type ServersSnapshot,
  type NodeView,
} from "@/lib/servers/model";

function nodeView(node: NodeView): NodeView {
  return {
    name: node.name,
    status: node.status,
    observed_at: node.observed_at,
    conditions: node.conditions,
    roles: node.roles,
    region: node.region,
    zone: node.zone,
    public_ip: node.public_ip,
    internal_ip: node.internal_ip,
    external_ip: node.external_ip,
    os_image: node.os_image,
    kubelet_version: node.kubelet_version,
    container_runtime: node.container_runtime,
    cpu: node.cpu,
    memory: node.memory,
    ephemeral_storage: node.ephemeral_storage,
    image_filesystem: node.image_filesystem,
    created_at: node.created_at,
    workloads: node.workloads?.map((w) => ({
      kind: w.kind,
      id: w.id,
      name: w.name,
      tenant_id: w.tenant_id,
      project_id: w.project_id,
      service_type: w.service_type,
      namespace: w.namespace,
      pod_count: w.pod_count,
      pods: w.pods?.map((p) => ({ name: p.name, phase: p.phase })),
    })),
  };
}
const timestamp = (v: Date | string | null) =>
  v instanceof Date ? v.toISOString() : v;

export async function serversSnapshot(
  workspace: WorkspaceAccess,
  isAdmin: boolean,
): Promise<ServersSnapshot> {
  const [runtimes, nodes, context, keys] = await Promise.allSettled([
    readRuntimes(workspace.adminKeySecret),
    readTenantNodes(workspace.adminKeySecret),
    getAuthContext(workspace.adminKeySecret),
    listNodeKeys(workspace.adminKeySecret),
  ]);
  const errors: string[] = [];
  if (runtimes.status === "rejected")
    errors.push("Server inventory is unavailable. Refresh to retry.");
  if (nodes.status === "rejected")
    errors.push("Node health and resource measurements are unavailable.");
  const verified =
    context.status === "fulfilled" &&
    context.value.tenantId === workspace.tenantId;
  const scopes =
    verified && context.status === "fulfilled" ? context.value.scopes : [];
  if (!verified)
    errors.push(
      "Server permissions could not be verified. Actions are disabled.",
    );
  const runtimeList = runtimes.status === "fulfilled" ? runtimes.value : [];
  const nodeMap = new Map(
    nodes.status === "fulfilled" ? nodes.value.map((n) => [n.name, n]) : [],
  );
  const liveKeys =
    keys.status === "fulfilled" && Array.isArray(keys.value.node_keys)
      ? keys.value.node_keys
      : null;
  if (!liveKeys)
    errors.push(
      "Node key sync is unavailable. Stored metadata may be outdated.",
    );
  else {
    try {
      await syncNodeKeyMetadata(workspace.email, workspace.tenantId, liveKeys);
    } catch {
      errors.push(
        "Node key sync is unavailable. Stored metadata may be outdated.",
      );
    }
  }
  const liveIds = new Set(
    liveKeys
      ?.filter(
        (k) => k.tenant_id === workspace.tenantId && k.status === "active",
      )
      .map((k) => k.id),
  );
  const counts = new Map<string, number>();
  for (const runtime of runtimeList)
    if (runtime.tenant_id === workspace.tenantId && runtime.node_key_id)
      counts.set(
        runtime.node_key_id,
        (counts.get(runtime.node_key_id) ?? 0) + 1,
      );
  let stored: Awaited<ReturnType<typeof readNodeKeyMetadata>> = [];
  try {
    stored = await readNodeKeyMetadata(workspace.email, workspace.tenantId);
  } catch {
    errors.push("Stored node keys are unavailable. Refresh to retry.");
  }
  // Include active CLI-created keys without resurrecting revoked/deleted mirrors.
  const storedIds = new Set(stored.map((k) => k.id));
  for (const key of liveKeys ?? []) {
    if (
      key.tenant_id === workspace.tenantId &&
      key.status === "active" &&
      !storedIds.has(key.id)
    ) {
      stored.push({
        id: key.id,
        label: key.label,
        prefix: key.prefix,
        status: "active",
        last_used_at: key.last_used_at,
        created_at: key.created_at,
        has_secret: false,
      });
    }
  }
  return {
    observedAt: new Date().toISOString(),
    errors,
    servers: runtimeList
      .filter((r) => ["managed-owned", "external-owned"].includes(r.type))
      .map((r) => ({
        runtime: runtimeView(r, workspace.tenantId),
        node:
          r.cluster_node_name && nodeMap.has(r.cluster_node_name)
            ? nodeView(nodeMap.get(r.cluster_node_name)!)
            : null,
        capabilities: runtimeCapabilities(r, {
          tenantId: workspace.tenantId,
          scopes,
          isAdmin: isAdmin && verified,
        }),
      })),
    keys: stored.map((k) => ({
      id: k.id,
      label: k.label,
      prefix: k.prefix,
      status: k.status,
      lastUsedAt: timestamp(k.last_used_at),
      createdAt: timestamp(k.created_at),
      hasSecret: k.has_secret && k.status === "active" && liveIds.has(k.id),
      attachedCount:
        runtimes.status === "fulfilled" ? (counts.get(k.id) ?? 0) : null,
    })),
  };
}
