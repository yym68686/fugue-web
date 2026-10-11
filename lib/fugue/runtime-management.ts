import "server-only";
import type { components } from "@/lib/fugue/openapi.generated";
import { fugueGet, fugueSend } from "@/lib/fugue/console";
import {
  isSelectableRuntime,
  runtimeView,
  type Runtime,
  type NodeView,
} from "@/lib/servers/model";

export type Sharing = components["schemas"]["RuntimeSharingResponse"];
export type Reservation = components["schemas"]["ProjectRuntimeReservation"];
export type MoveImpact = components["schemas"]["AppMoveImpact"];
const runtimePath = (id: string) => `/v1/runtimes/${encodeURIComponent(id)}`;
const projectPath = (id: string) => `/v1/projects/${encodeURIComponent(id)}`;

export async function readRuntimes(key: string) {
  const data = await fugueGet<{ runtimes: Runtime[] }>(
    key,
    "/v1/runtimes?sync_locations=false",
  );
  if (!Array.isArray(data.runtimes))
    throw new Error("Incomplete runtime inventory.");
  return data.runtimes;
}
export async function deploymentTargets(key: string, tenantId: string) {
  return (await readRuntimes(key))
    .filter(isSelectableRuntime)
    .map((r) => runtimeView(r, tenantId));
}
export async function readTenantNodes(key: string) {
  const data = await fugueGet<{ cluster_nodes: NodeView[] }>(
    key,
    "/v1/cluster/nodes?sync_locations=false",
  );
  if (!Array.isArray(data.cluster_nodes))
    throw new Error("Incomplete node inventory.");
  // Go omits an empty workloads slice; a successful inventory with no field
  // means zero visible workloads, not an unavailable measurement.
  return data.cluster_nodes.map((node) => ({
    ...node,
    workloads: node.workloads ?? [],
  }));
}
export async function readRuntime(key: string, id: string) {
  const data = await fugueGet<{ runtime: Runtime }>(key, runtimePath(id));
  if (data.runtime?.id !== id)
    throw new Error("Runtime response could not be verified.");
  return data.runtime;
}
export const readSharing = (key: string, id: string) =>
  fugueGet<Sharing>(key, `${runtimePath(id)}/sharing`);
export const setSharing = (
  key: string,
  id: string,
  sharing: "private" | "public",
) =>
  fugueSend<{ runtime: Runtime }>(
    key,
    "POST",
    `${runtimePath(id)}/byovps-sharing`,
    { sharing },
  );
export const grantRuntime = (key: string, id: string, tenantId: string) =>
  fugueSend(key, "POST", `${runtimePath(id)}/sharing/grants`, {
    tenant_id: tenantId,
  });
export const revokeRuntimeGrant = (key: string, id: string, tenantId: string) =>
  fugueSend(
    key,
    "DELETE",
    `${runtimePath(id)}/sharing/grants/${encodeURIComponent(tenantId)}`,
  );
export const setPublicOffer = (
  key: string,
  id: string,
  offer: components["schemas"]["SetRuntimePublicOfferRequest"],
) =>
  fugueSend<{ runtime: Runtime }>(
    key,
    "POST",
    `${runtimePath(id)}/public-offer`,
    offer,
  );
export const setRuntimeScope = (
  key: string,
  id: string,
  scope: "internal" | "byovps",
) =>
  fugueSend<{ runtime: Runtime; node_reconciled: boolean }>(
    key,
    "POST",
    `${runtimePath(id)}/scope`,
    { cluster_scope: scope },
  );
export const removeRuntime = (key: string, id: string) =>
  fugueSend<{ deleted: boolean }>(key, "DELETE", runtimePath(id));
export async function readProject(key: string, id: string) {
  const data = await fugueGet<{ project: components["schemas"]["Project"] }>(
    key,
    projectPath(id),
  );
  if (data.project?.id !== id)
    throw new Error("Project response could not be verified.");
  return data.project;
}
export const readReservations = (key: string, id: string) =>
  fugueGet<{ runtime_reservations: Reservation[] }>(
    key,
    `${projectPath(id)}/runtime-reservations`,
  );
export const reserveRuntime = (key: string, id: string, runtimeId: string) =>
  fugueSend(key, "POST", `${projectPath(id)}/runtime-reservations`, {
    runtime_id: runtimeId,
    mode: "exclusive",
  });
export const releaseRuntime = (key: string, id: string, runtimeId: string) =>
  fugueSend(
    key,
    "DELETE",
    `${projectPath(id)}/runtime-reservations/${encodeURIComponent(runtimeId)}`,
  );
export const setDefaultRuntime = (key: string, id: string, runtimeId: string) =>
  fugueSend(
    key,
    "PATCH",
    projectPath(id),
    runtimeId
      ? { default_runtime_id: runtimeId }
      : { clear_default_runtime_id: true },
  );
export const migrateApp = (
  key: string,
  id: string,
  targetRuntimeId: string,
  dryRun: boolean,
) =>
  fugueSend<{
    impact?: MoveImpact;
    operation?: components["schemas"]["Operation"];
  }>(key, "POST", `/v1/apps/${encodeURIComponent(id)}/migrate`, {
    target_runtime_id: targetRuntimeId,
    dry_run: dryRun,
  });
