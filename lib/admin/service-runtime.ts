import type { ConsoleApp } from "@/lib/fugue/console";

/** Keep every field used by readiness and failure details across the RSC boundary. */
export function serviceRuntimeInput(app: ConsoleApp) {
  const status = app.stored_status ?? app.status;
  const observed = app.observed_status;
  const failure = status?.last_failed_operation;
  const ssh = app.spec?.ssh;
  return {
    spec: app.spec ? {
      replicas: app.spec.replicas,
      ports: app.spec.ports,
      ssh: ssh && typeof ssh === "object"
        ? { enabled: (ssh as { enabled?: unknown }).enabled }
        : ssh,
    } : undefined,
    storedStatus: status ? {
      phase: status.phase,
      last_failed_operation: failure ? {
        id: failure.id,
        type: failure.type,
        error_message: failure.error_message,
        result_message: failure.result_message,
        created_at: failure.created_at,
        updated_at: failure.updated_at,
      } : failure,
    } : null,
    observedStatus: observed ? {
      phase: observed.phase,
      desired_replicas: observed.desired_replicas,
      ready_replicas: observed.ready_replicas,
      runtime_object_present: observed.runtime_object_present,
      namespace_present: observed.namespace_present,
      service_present: observed.service_present,
      endpoint_present: observed.endpoint_present,
      endpoint_ready: observed.endpoint_ready,
      physical_replicas: observed.physical_replicas,
      physical_desired_replicas: observed.physical_desired_replicas,
      image_present: observed.image_present,
      fresh: observed.fresh,
      observed_at: observed.observed_at,
      cluster_id: observed.cluster_id,
      generation: observed.generation,
      observed_generation: observed.observed_generation,
      evidence_source: observed.evidence_source,
      invariant_violations: observed.invariant_violations,
    } : null,
  };
}
