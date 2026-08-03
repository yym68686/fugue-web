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

/**
 * A last-failed-operation ready for display: the message plus enough context to
 * weight it honestly.
 *
 * `superseded` is the important field. `last_failed_operation` is durable
 * diagnostic history with no expiry, so an import that failed days ago keeps
 * being reported next to a healthy app forever. When the release that is
 * currently ready started *after* the failure completed, the failure has
 * demonstrably been overtaken by a successful rollout and must not be presented
 * with the same weight as a live problem.
 */
export type ObservedFailureNotice = {
  summary: string;
  type: string | null;
  id: string | null;
  occurredAt: string | null;
  superseded: boolean;
};

export function observedFailureNotice(
  app: ObservedAppShape,
): ObservedFailureNotice | null {
  const summary = observedFailureSummary(app);
  if (!summary) return null;

  const failure = app.status?.last_failed_operation ?? app.stored_status?.last_failed_operation;
  const occurredAt = failure?.completed_at || failure?.updated_at || failure?.created_at || null;
  const status = app.status ?? app.stored_status;
  const readyAt = status?.current_release_ready_at;
  const releaseStartedAt = status?.current_release_started_at;

  // Only a release that is both ready and newer than the failure supersedes it.
  const failedAtMs = occurredAt ? Date.parse(occurredAt) : NaN;
  const releaseMs = releaseStartedAt ? Date.parse(releaseStartedAt) : NaN;
  const superseded =
    Boolean(readyAt) &&
    Number.isFinite(failedAtMs) &&
    Number.isFinite(releaseMs) &&
    releaseMs > failedAtMs;

  const type = String(failure?.type ?? "").trim() || null;
  const id = String(failure?.id ?? "").trim() || null;

  return { summary, type, id, occurredAt, superseded };
}

/**
 * Why the current observation fails the readiness contract.
 *
 * `observedStatusMessage` is the wrong thing to show for this: it falls back to
 * `last_message`, which describes the last *operation*. A ready deployment whose
 * observation has merely aged out therefore reported "deployment ready (2/2
 * replicas)" as its reason for being unavailable. These branches mirror the
 * order of the checks in `isObservedReady`, so the reason names the check that
 * actually failed, and none of them can be a success message.
 */
export type ObservedUnreadyReason =
  | { kind: "no_evidence" }
  | { kind: "scaled_to_zero" }
  | { kind: "stale"; ageMs: number }
  | { kind: "violations"; violations: string[] }
  | { kind: "converging" }
  | { kind: "phase"; phase: string }
  | { kind: "endpoint" }
  | { kind: "replicas"; ready: number | null; desired: number }
  | { kind: "image" }
  | { kind: "unknown" };

export function observedUnreadyReason(
  app: ObservedAppShape,
  now = Date.now(),
  maxAgeMs = DEFAULT_MAX_AGE_MS,
): ObservedUnreadyReason | null {
  if (isObservedReady(app, now, maxAgeMs)) return null;

  const observed = app.observed_status;
  if (!observed) return { kind: "no_evidence" };

  const specReplicas = app.spec?.replicas;
  if (finite(specReplicas) && specReplicas <= 0) return { kind: "scaled_to_zero" };

  const violations = observed.invariant_violations ?? [];
  if (violations.length > 0) return { kind: "violations", violations: [...violations] };

  // Staleness outranks the remaining branches: once the evidence has aged out,
  // every field below it describes a moment that may no longer hold.
  const observedAt = observed.observed_at ? Date.parse(observed.observed_at) : NaN;
  if (observed.fresh !== true || !Number.isFinite(observedAt)) {
    return { kind: "stale", ageMs: Number.isFinite(observedAt) ? Math.max(0, now - observedAt) : 0 };
  }
  if (observedAt > now + 30_000 || now - observedAt > maxAgeMs) {
    return { kind: "stale", ageMs: Math.max(0, now - observedAt) };
  }

  const desired = finite(specReplicas) ? specReplicas : observed.desired_replicas;
  if (
    !finite(desired) ||
    !finite(observed.desired_replicas) ||
    observed.desired_replicas !== desired ||
    !finite(observed.generation) ||
    !finite(observed.observed_generation) ||
    observed.generation <= 0 ||
    observed.observed_generation < observed.generation
  ) {
    return { kind: "converging" };
  }

  const phase = String(observed.phase ?? "").toLowerCase();
  if (phase !== "deployed") return { kind: "phase", phase: observed.phase || "unknown" };

  if (
    !observed.cluster_id ||
    !observed.evidence_source ||
    observed.runtime_object_present !== true ||
    observed.namespace_present !== true ||
    observed.endpoint_present !== true ||
    observed.endpoint_ready !== true ||
    (appNeedsService(app.spec) && observed.service_present !== true)
  ) {
    return { kind: "endpoint" };
  }

  const ready = observed.ready_replicas;
  const physical = observed.physical_replicas;
  if (
    !finite(ready) ||
    ready < desired ||
    !finite(physical) ||
    physical < desired ||
    physical <= 0 ||
    (finite(observed.physical_desired_replicas) && observed.physical_desired_replicas < desired)
  ) {
    return { kind: "replicas", ready: finite(ready) ? ready : null, desired };
  }

  if (observed.image_present !== true) return { kind: "image" };

  return { kind: "unknown" };
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
