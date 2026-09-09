import type { ConsoleApp } from "@/lib/fugue/console";

/** Keep every field used by readiness and failure details across the RSC boundary. */
export function serviceRuntimeInput(app: ConsoleApp) {
  const status = app.stored_status ?? app.status;
  return {
    spec: app.spec ? {
      replicas: app.spec.replicas,
      ports: app.spec.ports,
      ssh: app.spec.ssh,
    } : undefined,
    storedStatus: status ? {
      phase: status.phase,
      last_failed_operation: status.last_failed_operation,
    } : null,
  };
}
