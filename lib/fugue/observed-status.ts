import type {
  AppDetailStatus,
  ConsoleAppDetail,
  ConsoleAppStatus,
} from "@/lib/fugue/console";

export type ObservedStatusTone = "ok" | "run" | "err" | "warn" | "idle";

const DEFAULT_MAX_AGE_MS = 60_000;
type ConsoleStatus = ConsoleAppStatus | AppDetailStatus;
export type ObservedAppShape = {
  spec?: ConsoleAppDetail["spec"];
  route?: ConsoleAppDetail["route"];
  status?: ConsoleStatus | null;
  stored_status?: ConsoleStatus | null;
  observed_status?: ConsoleAppDetail["observed_status"];
};

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function appNeedsService(spec: ObservedAppShape["spec"]): boolean {
  if ((spec?.ports ?? []).some((port) => finite(port) && port > 0)) return true;
  const ssh = spec?.ssh;
  if (ssh === true) return true;
  if (ssh && typeof ssh === "object") {
    const enabled = (ssh as { enabled?: unknown }).enabled;
    return enabled === true;
  }
  return false;
}

/**
 * Green is deliberately evidence-bound. A durable `status.phase=deployed`
 * or historical replica count never qualifies by itself.
 */
export function isObservedReady(
  app: ObservedAppShape,
  now = Date.now(),
  maxAgeMs = DEFAULT_MAX_AGE_MS,
): boolean {
  const observed = app.observed_status;
  const specReplicas = app.spec?.replicas;
  const observedDesired = observed?.desired_replicas;
  // Both sides of the desired/observed contract must agree. Trusting a lower
  // observed desired count would let an incomplete rollout satisfy a weaker
  // readiness threshold than the current durable spec.
  if (
    !observed ||
    !finite(specReplicas) ||
    !finite(observedDesired) ||
    specReplicas <= 0 ||
    observedDesired !== specReplicas
  ) {
    return false;
  }
  const desired = specReplicas;
  if (String(observed.phase ?? "").toLowerCase() !== "deployed") return false;
  if (observed.fresh !== true) return false;
  if (!observed.observed_at) return false;
  const observedAt = Date.parse(observed.observed_at);
  if (!Number.isFinite(observedAt) || observedAt > now + 30_000 || now - observedAt > maxAgeMs) {
    return false;
  }
  if (!observed.cluster_id || !observed.evidence_source) return false;
  if (observed.runtime_object_present !== true || observed.namespace_present !== true) return false;
  // Active apps must have a proven endpoint. This intentionally fails closed
  // for background apps until the backend explicitly supplies endpoint
  // evidence, avoiding a false green from the route/control-plane state.
  if (observed.endpoint_present !== true || observed.endpoint_ready !== true) return false;
  if (appNeedsService(app.spec) && observed.service_present !== true) return false;
  const ready = observed.ready_replicas;
  const physical = observed.physical_replicas;
  if (!finite(ready) || ready < desired) return false;
  if (!finite(physical) || physical < desired || physical <= 0) return false;
  if (finite(observed.physical_desired_replicas) && observed.physical_desired_replicas < desired) return false;
  if (!finite(observed.generation) || !finite(observed.observed_generation) || observed.generation <= 0) {
    return false;
  }
  if (observed.observed_generation < observed.generation) return false;
  if (observed.image_present !== true) return false;
  if ((observed.invariant_violations ?? []).length > 0) return false;
  return true;
}

export function observedStatusTone(
  app: ObservedAppShape,
  now = Date.now(),
): ObservedStatusTone {
  if (isObservedReady(app, now)) return "ok";
  const phase = String(app.observed_status?.phase ?? app.status?.phase ?? "").toLowerCase();
  if (["failed", "error"].includes(phase) || (app.observed_status?.invariant_violations?.length ?? 0) > 0) {
    return "err";
  }
  if (["deploying", "progressing", "building", "queued", "pending", "migrating"].includes(phase)) {
    return "run";
  }
  if (["disabled", "paused", "stopped", "unavailable", "unknown", "deleting"].includes(phase)) {
    return "warn";
  }
  if (["deployed", "ready", "running", "active", "healthy"].includes(phase)) return "warn";
  return "idle";
}

export function observedStatusLabel(
  app: ObservedAppShape,
): string {
  if (app.observed_status?.phase) return app.observed_status.phase;
  const legacy = String(app.status?.phase ?? "").trim();
  if (["deployed", "running", "ready", "active", "healthy"].includes(legacy.toLowerCase())) {
    return "unknown";
  }
  return legacy || "unknown";
}

export function lastFailedOperation(
  app: ObservedAppShape,
): ConsoleAppStatus["last_failed_operation"] {
  return app.status?.last_failed_operation ?? app.stored_status?.last_failed_operation ?? null;
}

export function observedFailureSummary(
  app: ObservedAppShape,
): string | null {
  const failure = app.status?.last_failed_operation ?? app.stored_status?.last_failed_operation;
  if (failure?.error_message || failure?.result_message) {
    return failure.error_message || failure.result_message || null;
  }
  if (failure) {
    const type = String(failure.type ?? '').trim();
    const id = String(failure.id ?? '').trim();
    if (type && id) return `${type} (${id})`;
    if (type || id) return type || id;
  }
  return null;
}

/** Current observation context for a warning; deliberately not labelled as a failure. */
export function observedStatusMessage(
  app: ObservedAppShape,
): string | null {
  return (
    app.observed_status?.message ||
    app.observed_status?.reason ||
    app.status?.last_message ||
    app.stored_status?.last_message ||
    null
  );
}
