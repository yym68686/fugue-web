import type { components } from "@/lib/fugue/openapi.generated";
import type { ClusterNode } from "@/lib/fugue/console";

export type Runtime = components["schemas"]["Runtime"];
export type PublicOffer = components["schemas"]["RuntimePublicOffer"];
export type RuntimeView = Pick<
  Runtime,
  | "id"
  | "tenant_id"
  | "name"
  | "machine_name"
  | "type"
  | "status"
  | "endpoint"
  | "node_key_id"
  | "cluster_node_name"
  | "last_seen_at"
  | "last_heartbeat_at"
  | "created_at"
  | "updated_at"
  | "cluster_scope"
  | "sharing"
  | "access_mode"
  | "pool_mode"
> & {
  public_offer?: PublicOffer;
  owned: boolean;
  kind: "owned" | "shared" | "public" | "internal";
  country: string | null;
  location: string | null;
};
export type NodeView = ClusterNode & {
  observed_at?: string;
  conditions?: Record<
    string,
    {
      status?: string;
      reason?: string;
      message?: string;
      last_transition_at?: string;
    }
  >;
};
export type ServerCapabilities = {
  sharing: boolean;
  scope: boolean;
  delete: boolean;
};
export type ServerView = {
  runtime: RuntimeView;
  node: NodeView | null;
  capabilities: ServerCapabilities;
};
export type NodeKeyView = {
  id: string;
  label: string;
  prefix: string | null;
  status: "active" | "revoked";
  lastUsedAt: string | null;
  createdAt: string | null;
  hasSecret: boolean;
  attachedCount: number | null;
};
export type ServersSnapshot = {
  servers: ServerView[];
  keys: NodeKeyView[];
  errors: string[];
  observedAt: string;
};

export function isInternalRuntime(
  runtime: Pick<Runtime, "cluster_scope" | "type" | "pool_mode">,
) {
  return (
    runtime.cluster_scope === "internal" ||
    runtime.type === "managed-shared" ||
    runtime.pool_mode === "internal-shared"
  );
}

/** Explicit projection: agent credentials and fingerprints never reach RSC/browser payloads. */
export function runtimeView(runtime: Runtime, tenantId: string): RuntimeView {
  const owned = Boolean(tenantId && runtime.tenant_id === tenantId);
  const country = runtime.labels?.["fugue.io/location-country-code"];
  const offer = runtime.public_offer;
  return {
    id: runtime.id,
    tenant_id: runtime.tenant_id,
    name: runtime.name,
    machine_name: runtime.machine_name,
    type: runtime.type,
    status: runtime.status,
    endpoint: runtime.endpoint,
    node_key_id: runtime.node_key_id,
    cluster_node_name: runtime.cluster_node_name,
    last_seen_at: runtime.last_seen_at,
    last_heartbeat_at: runtime.last_heartbeat_at,
    created_at: runtime.created_at,
    updated_at: runtime.updated_at,
    cluster_scope: isInternalRuntime(runtime) ? "internal" : "byovps",
    sharing: isInternalRuntime(runtime)
      ? null
      : (runtime.sharing ??
        (runtime.access_mode === "public" ? "public" : "private")),
    access_mode: runtime.access_mode,
    pool_mode: runtime.pool_mode,
    public_offer: offer
      ? {
          free: offer.free,
          free_cpu: offer.free_cpu,
          free_memory: offer.free_memory,
          free_storage: offer.free_storage,
          reference_monthly_price_microcents:
            offer.reference_monthly_price_microcents,
          reference_bundle: {
            cpu_millicores: offer.reference_bundle.cpu_millicores,
            memory_mebibytes: offer.reference_bundle.memory_mebibytes,
            storage_gibibytes: offer.reference_bundle.storage_gibibytes,
          },
          price_book: {
            currency: offer.price_book.currency,
            hours_per_month: offer.price_book.hours_per_month,
            cpu_microcents_per_millicore_hour:
              offer.price_book.cpu_microcents_per_millicore_hour,
            memory_microcents_per_mib_hour:
              offer.price_book.memory_microcents_per_mib_hour,
            storage_microcents_per_gib_hour:
              offer.price_book.storage_microcents_per_gib_hour,
          },
          updated_at: offer.updated_at,
        }
      : undefined,
    owned,
    kind: isInternalRuntime(runtime)
      ? "internal"
      : owned
        ? "owned"
        : runtime.sharing === "public" || runtime.access_mode === "public"
          ? "public"
          : "shared",
    country:
      country && /^[a-z]{2}$/i.test(country) ? country.toUpperCase() : null,
    location:
      runtime.labels?.["fugue.io/location-region"] ??
      runtime.labels?.["fugue.io/location-country"] ??
      null,
  };
}

export function runtimeCapabilities(
  runtime: Pick<
    Runtime,
    "tenant_id" | "type" | "pool_mode" | "cluster_scope" | "status"
  >,
  actor: { tenantId: string; isAdmin: boolean; scopes: readonly string[] },
): ServerCapabilities {
  const owned = Boolean(actor.tenantId && runtime.tenant_id === actor.tenantId);
  const writable = actor.scopes.includes("runtime.write");
  return {
    sharing: owned && writable && !isInternalRuntime(runtime),
    scope: owned && actor.isAdmin && runtime.type === "managed-owned",
    delete: owned && writable && runtime.status.toLowerCase() === "offline",
  };
}

export function isSelectableRuntime(runtime: Pick<Runtime, "status">) {
  return ["active", "ready", "running", "online"].includes(
    runtime.status.toLowerCase(),
  );
}

export function nodeHealth(
  node: NodeView | null,
  now: number,
): "ready" | "unready" | "unknown" {
  if (!node?.observed_at) return "unknown";
  const age = now - Date.parse(node.observed_at);
  if (!Number.isFinite(age) || age < -30_000 || age > 5 * 60_000)
    return "unknown";
  if (node.conditions?.Ready?.status?.toLowerCase() !== "true")
    return "unready";
  return ["MemoryPressure", "DiskPressure", "PIDPressure"].some(
    (key) => node.conditions?.[key]?.status?.toLowerCase() === "true",
  )
    ? "unready"
    : "ready";
}

export function publicOfferFree(offer?: PublicOffer) {
  return Boolean(
    offer &&
      (offer.free ||
        !offer.reference_monthly_price_microcents ||
        (offer.free_cpu && offer.free_memory && offer.free_storage)),
  );
}

export function validatePublicOffer(
  value: unknown,
): components["schemas"]["SetRuntimePublicOfferRequest"] {
  const fail = () => {
    throw Object.assign(
      new Error("Enter valid non-negative prices and resource amounts."),
      { status: 400 },
    );
  };
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail();
  const input = value as Record<string, unknown>;
  const bundle = input.reference_bundle as Record<string, unknown> | undefined;
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle))
    return fail();
  const integer = (v: unknown) =>
    typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
  const names = [
    "cpu_millicores",
    "memory_mebibytes",
    "storage_gibibytes",
  ] as const;
  for (const key of names) if (!integer(bundle[key])) return fail();
  if (!integer(input.reference_monthly_price_microcents)) return fail();
  for (const key of ["free", "free_cpu", "free_memory", "free_storage"])
    if (typeof input[key] !== "boolean") return fail();
  const free =
    input.free || (input.free_cpu && input.free_memory && input.free_storage);
  if (!free) {
    for (const [i, key] of names.entries()) {
      if (
        !input[["free_cpu", "free_memory", "free_storage"][i]] &&
        !((bundle[key] as number) > 0)
      )
        return fail();
    }
  }
  return {
    reference_bundle: {
      cpu_millicores: bundle.cpu_millicores as number,
      memory_mebibytes: bundle.memory_mebibytes as number,
      storage_gibibytes: bundle.storage_gibibytes as number,
    },
    reference_monthly_price_microcents:
      input.reference_monthly_price_microcents as number,
    free: input.free as boolean,
    free_cpu: input.free_cpu as boolean,
    free_memory: input.free_memory as boolean,
    free_storage: input.free_storage as boolean,
  };
}
