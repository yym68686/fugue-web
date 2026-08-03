import assert from "node:assert/strict";
import test from "node:test";

import {
  isObservedReady,
  type ObservedAppShape,
  observedFailureNotice,
  observedFailureSummary,
  observedStatusLabel,
  observedStatusMessage,
  observedStatusTone,
  observedUnreadyReason,
} from "@/lib/fugue/observed-status";
import { unreadyReasonText } from "@/lib/fugue/unready-reason";
import { createTranslator } from "@/lib/i18n/translate";
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

test("a ready app has no unready reason", () => {
  assert.equal(observedUnreadyReason(healthy(), now), null);
});

// The defect this guards: the Route panel used observedStatusMessage, which
// falls back to last_message, so an app whose observation had merely aged out
// displayed "deployment ready (2/2 replicas)" as its reason for being
// unavailable.
test("an aged-out observation reports staleness, never the last success message", () => {
  const app: ObservedAppShape = {
    ...healthy({ observed_at: "2026-07-29T23:57:00Z" }),
    status: {
      phase: "deployed",
      last_message: "deployment ready (2/2 replicas)",
    },
  };
  assert.equal(isObservedReady(app, now), false);
  const reason = observedUnreadyReason(app, now);
  assert.equal(reason?.kind, "stale");
  const text = unreadyReasonText(reason, (k, v) =>
    k.replace(/\{(\w+)\}/g, (_, n) => String(v?.[n] ?? "")),
  );
  assert.match(text, /past the freshness window/);
  assert.doesNotMatch(text, /deployment ready/);
});

test("each unready reason names the check that actually failed", () => {
  const cases: Array<[ObservedAppShape, string]> = [
    [{ spec: { replicas: 1 } }, "no_evidence"],
    [{ ...healthy(), spec: { replicas: 0 } }, "scaled_to_zero"],
    [healthy({ invariant_violations: ["endpoint_unready"] }), "violations"],
    [healthy({ fresh: false }), "stale"],
    [healthy({ observed_generation: 3 }), "converging"],
    [healthy({ phase: "deploying" }), "phase"],
    [healthy({ endpoint_ready: false }), "endpoint"],
    [healthy({ ready_replicas: 0 }), "replicas"],
    [healthy({ image_present: false }), "image"],
  ];
  for (const [app, expected] of cases) {
    assert.equal(observedUnreadyReason(app, now)?.kind, expected, `expected ${expected}`);
  }
});

test("every unready reason kind maps to non-empty copy", () => {
  const identity = (k: string, v?: Record<string, unknown>) =>
    k.replace(/\{(\w+)\}/g, (_, n) => String(v?.[n] ?? ""));
  const kinds: Parameters<typeof unreadyReasonText>[0][] = [
    { kind: "no_evidence" },
    { kind: "scaled_to_zero" },
    { kind: "stale", ageMs: 125_000 },
    { kind: "stale", ageMs: 0 },
    { kind: "violations", violations: ["endpoint_unready"] },
    { kind: "converging" },
    { kind: "phase", phase: "deploying" },
    { kind: "endpoint" },
    { kind: "replicas", ready: null, desired: 2 },
    { kind: "replicas", ready: 1, desired: 2 },
    { kind: "image" },
    { kind: "unknown" },
  ];
  for (const kind of kinds) {
    const text = unreadyReasonText(kind, identity);
    assert.ok(text.length > 0, `empty copy for ${JSON.stringify(kind)}`);
    assert.doesNotMatch(text, /\{|\}/, `unsubstituted placeholder for ${JSON.stringify(kind)}`);
  }
  assert.equal(unreadyReasonText(null, identity), "");
});

// A missing catalog entry renders the English key with no error, so the copy
// has to be asserted against the real translator rather than a stub.
test("every reason and notice string is translated for zh-CN", () => {
  const zh = createTranslator("zh-CN");
  const kinds: Parameters<typeof unreadyReasonText>[0][] = [
    { kind: "no_evidence" },
    { kind: "scaled_to_zero" },
    { kind: "stale", ageMs: 125_000 },
    { kind: "stale", ageMs: 0 },
    { kind: "violations", violations: ["endpoint_unready"] },
    { kind: "converging" },
    { kind: "phase", phase: "deploying" },
    { kind: "endpoint" },
    { kind: "replicas", ready: null, desired: 2 },
    { kind: "replicas", ready: 1, desired: 2 },
    { kind: "image" },
    { kind: "unknown" },
  ];
  for (const kind of kinds) {
    const out = unreadyReasonText(kind, zh);
    assert.match(out, /[一-鿿]/, `not translated: ${JSON.stringify(kind)} -> ${out}`);
    assert.doesNotMatch(out, /\{|\}/, `unsubstituted placeholder: ${out}`);
  }
  for (const key of [
    "An earlier operation failed. A later release has since deployed successfully.",
    "The last operation failed.",
    "Show details",
    "Hide details",
  ]) {
    assert.match(zh(key), /[一-鿿]/, `not translated: ${key}`);
  }
});

test("a failure older than the current ready release is marked superseded", () => {
  const notice = observedFailureNotice({
    ...healthy(),
    status: {
      phase: "deployed",
      current_release_started_at: "2026-08-03T04:35:40Z",
      current_release_ready_at: "2026-08-03T04:36:13Z",
      last_failed_operation: {
        id: "op_old",
        type: "import",
        error_message: "distributed image import produced no verified replica",
        created_at: "2026-07-23T10:51:57Z",
        completed_at: "2026-07-23T10:53:33Z",
      },
    },
  });
  assert.equal(notice?.superseded, true);
  assert.equal(notice?.type, "import");
  assert.equal(notice?.id, "op_old");
  assert.equal(notice?.occurredAt, "2026-07-23T10:53:33Z");
});

test("a failure newer than the current release is not superseded", () => {
  const base = {
    phase: "deployed",
    current_release_started_at: "2026-08-03T04:35:40Z",
    current_release_ready_at: "2026-08-03T04:36:13Z",
    last_failed_operation: {
      id: "op_new",
      type: "deploy",
      error_message: "rollout failed",
      created_at: "2026-08-03T05:00:00Z",
      completed_at: "2026-08-03T05:00:30Z",
    },
  };
  assert.equal(observedFailureNotice({ ...healthy(), status: base })?.superseded, false);
  // A release that started but never became ready cannot supersede anything.
  assert.equal(
    observedFailureNotice({
      ...healthy(),
      status: { ...base, current_release_ready_at: undefined },
    })?.superseded,
    false,
  );
  assert.equal(observedFailureNotice(healthy()), null);
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
