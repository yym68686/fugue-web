import assert from "node:assert/strict";
import test from "node:test";
import { serviceRuntimeInput } from "@/lib/admin/service-runtime";
import { isObservedReady, observedStatusTone, observedFailureSummary } from "@/lib/fugue/observed-status";
import type { ConsoleApp } from "@/lib/fugue/console";

test("service payload preserves readiness, stale evidence and full failure details", () => {
  const now = Date.parse("2026-09-09T12:00:00Z");
  const app: ConsoleApp = {
    id: "app", name: "service",
    spec: { replicas: 2, ports: [8080], ssh: { enabled: true }, persistent_storage: { mounts: [{ seed_content: "unused configuration" }] } },
    status: { phase: "deployed" },
    stored_status: { phase: "deployed", last_failed_operation: { id: "old-failure", type: "deploy", error_message: "complete diagnostic details" } },
    observed_status: {
      phase: "deployed", fresh: true, observed_at: "2026-09-09T11:59:55Z",
      cluster_id: "cluster", evidence_source: "kubernetes_api",
      desired_replicas: 2, ready_replicas: 2, physical_replicas: 2,
      runtime_object_present: true, namespace_present: true, endpoint_present: true,
      endpoint_ready: true, service_present: true, image_present: true,
      generation: 3, observed_generation: 3,
    },
  };
  for (const observation of [app.observed_status, { ...app.observed_status, fresh: false }, { ...app.observed_status, service_present: false }, null]) {
    const original = { ...app, observed_status: observation };
    const input = serviceRuntimeInput(original);
    const projected = { spec: input.spec, status: input.storedStatus, observed_status: observation };
    assert.equal(isObservedReady(projected, now), isObservedReady(original, now));
    assert.equal(observedStatusTone(projected, now), observedStatusTone(original, now));
    assert.equal(observedFailureSummary(projected), observedFailureSummary(original));
    assert.equal(JSON.stringify(input).includes("unused configuration"), false);
  }
});
