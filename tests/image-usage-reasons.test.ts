import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeAppImageInventoryResponse,
  normalizeProjectImageUsageResponse,
  projectImageMeasurement,
  rollupProjectResources,
} from "@/lib/fugue/console";

test("app image inventory preserves aggregate and per-version reasons", () => {
  const inventory = normalizeAppImageInventoryResponse({
    registry_configured: false,
    measurement_status: "partial",
    measurement_reasons: ["size_conflict", "unknown_reason", "size_conflict"],
    versions: [
      {
        image_ref: "registry.example/fugue-apps/example:build-a",
        size_bytes: 128,
        size_measurement_status: "partial",
        size_measurement_reasons: [
          "missing_blob_size_evidence",
          "unknown_reason",
          "missing_blob_size_evidence",
        ],
      },
    ],
  });

  assert.deepEqual(inventory.measurement_reasons, ["size_conflict"]);
  assert.deepEqual(inventory.versions[0]?.size_measurement_reasons, [
    "missing_blob_size_evidence",
  ]);
});

test("complete image measurements discard contradictory reason fields", () => {
  const inventory = normalizeAppImageInventoryResponse({
    measurement_status: "complete",
    measurement_reasons: ["digest_conflict"],
    versions: [
      {
        image_ref: "registry.example/fugue-apps/example:build-a",
        size_bytes: 128,
        size_measurement_status: "complete",
        size_measurement_reasons: ["missing_blob"],
      },
    ],
  });

  assert.equal(inventory.measurement_reasons, undefined);
  assert.equal(inventory.versions[0]?.size_measurement_reasons, undefined);
});

test("project image usage preserves only stable measurement reasons", () => {
  const response = normalizeProjectImageUsageResponse({
    measurement_status: "partial",
    measurement_reasons: ["digest_conflict", "unknown_reason", "digest_conflict"],
    projects: [
      {
        project_id: "project-a",
        version_count: 1,
        current_version_count: 1,
        stale_version_count: 0,
        total_size_bytes: 128,
        measurement_status: "partial",
        measurement_reasons: ["missing_blob", "unknown_reason", "missing_blob"],
      },
    ],
  });

  assert.deepEqual(response.measurement_reasons, ["digest_conflict"]);
  assert.deepEqual(response.projects[0]?.measurement_reasons, ["missing_blob"]);
  assert.deepEqual(projectImageMeasurement(response, "project-a").measurement_reasons, [
    "missing_blob",
  ]);
});

test("project resource rollups carry project-specific measurement reasons", () => {
  const response = normalizeProjectImageUsageResponse({
    measurement_status: "partial",
    measurement_reasons: ["digest_conflict"],
    projects: [
      {
        project_id: "project-a",
        version_count: 1,
        current_version_count: 1,
        stale_version_count: 0,
        total_size_bytes: 128,
        measurement_status: "partial",
        measurement_reasons: ["missing_blob_size_evidence"],
      },
    ],
  });

  const rollup = rollupProjectResources([], response).get("project-a");
  assert.deepEqual(rollup?.image_measurement_reasons, ["missing_blob_size_evidence"]);
});
