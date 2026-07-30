import assert from "node:assert/strict";
import test from "node:test";

import {
  isObservedReady,
  type ObservedAppShape,
  observedFailureSummary,
  observedStatusLabel,
  observedStatusMessage,
  observedStatusTone,
} from "@/lib/fugue/observed-status";
import type { ConsoleObservedStatus } from "@/lib/fugue/console";

const now = Date.parse("2026-07-30T00:00:00Z");

function healthy(overrides: Partial<ConsoleObservedStatus> = {}): ObservedAppShape {
  return {
    spec: { replicas: 1 },
    route: { public_url: "https://app.example.test" },
    status: { phase: "deployed" },
    observed_status: {
      phase: "deployed",
      desired_replicas: 1,
      ready_replicas: 1,
      physical_replicas: 1,
      runtime_object_present: true,
      namespace_present: true,
      endpoint_present: true,
      endpoint_ready: true,
      image_present: true,
      fresh: true,
      observed_at: "2026-07-29T23:59:30Z",
      cluster_id: "cluster-a",
      generation: 4,
      observed_generation: 4,
      evidence_source: "kubernetes_api",
      ...overrides,
    },
  };
}

test("only complete fresh runtime evidence is green", () => {
  assert.equal(isObservedReady(healthy(), now), true);
  assert.equal(observedStatusTone(healthy(), now), "ok");
});

test("a stale or incomplete observation cannot reuse deployed state", () => {
  assert.equal(isObservedReady(healthy({ fresh: false }), now), false);
  assert.equal(isObservedReady(healthy({ endpoint_present: false }), now), false);
  assert.equal(isObservedReady(healthy({ physical_replicas: 0 }), now), false);
  assert.equal(observedStatusTone(healthy({ endpoint_ready: false }), now), "warn");
});

test("freshness is bounded by observed_at instead of trusting the flag alone", () => {
  assert.equal(
    isObservedReady(healthy({ observed_at: "2026-07-29T23:58:59Z" }), now),
    false,
  );
  assert.equal(
    isObservedReady(healthy({ observed_at: "2026-07-30T00:00:31Z" }), now),
    false,
  );
});

test("image and evidence identity are mandatory for green", () => {
  assert.equal(isObservedReady(healthy({ image_present: false }), now), false);
  assert.equal(isObservedReady(healthy({ image_present: undefined }), now), false);
  assert.equal(isObservedReady(healthy({ cluster_id: "" }), now), false);
  assert.equal(isObservedReady(healthy({ evidence_source: "" }), now), false);
  assert.equal(isObservedReady(healthy({ generation: 0, observed_generation: 0 }), now), false);
});

test("query failure remains unknown even when stored phase is deployed", () => {
  const app = healthy({ fresh: false, phase: "unknown", reason: "kubernetes_query_failed" });
  assert.equal(isObservedReady(app, now), false);
  assert.equal(observedStatusTone(app, now), "warn");
});

test("legacy green phase without an observation is labeled unknown", () => {
  assert.equal(observedStatusLabel({ status: { phase: "deployed" } }), "unknown");
  assert.equal(observedStatusLabel({ status: { phase: "failed" } }), "failed");
});

test("last failure is read from the durable status projection", () => {
  const summary = observedFailureSummary({
    status: { phase: "unknown" },
    stored_status: {
      phase: "deployed",
      last_failed_operation: { error_message: "migration target was not ready" },
    },
    observed_status: { phase: "unknown", fresh: false, reason: "kubernetes_query_failed" },
  });
  assert.equal(summary, "migration target was not ready");
});

test("historical failure remains visible but cannot override current runtime proof", () => {
  const app = {
    ...healthy(),
    stored_status: {
      phase: "failed",
      last_failed_operation: {
        id: "op_old_failure",
        type: "deploy",
        error_message: "old rollout failed",
      },
    },
  };
  assert.equal(isObservedReady(app, now), true);
  assert.equal(observedFailureSummary(app), "old rollout failed");
});

test("an observation reason is not mislabeled as a last failed operation", () => {
  const app: ObservedAppShape = {
    status: { phase: "unknown", last_message: "live observation is unavailable" },
    observed_status: { phase: "unknown", reason: "kubernetes_query_failed" },
  };
  assert.equal(observedFailureSummary(app), null);
  assert.equal(observedStatusMessage(app), "kubernetes_query_failed");
});

test("last generation and invariant checks are part of the green gate", () => {
  assert.equal(isObservedReady(healthy({ observed_generation: 3 }), now), false);
  assert.equal(isObservedReady(healthy({ invariant_violations: ["endpoint_unready"] }), now), false);
});

test("desired replicas must agree with the durable spec", () => {
  assert.equal(isObservedReady(healthy({ desired_replicas: 0 }), now), false);
  assert.equal(
    isObservedReady({
      ...healthy({ desired_replicas: 1 }),
      spec: { replicas: 2 },
    }, now),
    false,
  );
  assert.equal(
    isObservedReady({
      ...healthy(),
      spec: {},
    }, now),
    false,
  );
});
