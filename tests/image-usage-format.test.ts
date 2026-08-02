import assert from "node:assert/strict";
import test from "node:test";

import {
  fmtImageMeasurementTitle,
  imageMeasurementReasonMessageKey,
  type ImageMeasurementReason,
} from "@/lib/format";
import { zhCN } from "@/lib/i18n/messages";

const identity = (key: string) => key;

test("image measurement titles explain stable reason codes", () => {
  assert.equal(
    fmtImageMeasurementTitle(
      "partial",
      ["digest_conflict", "missing_blob", "digest_conflict"],
      "backend note",
      identity,
    ),
    "Only a lower-bound image measurement is available: Different cache nodes reported different image digests; A referenced image blob is missing: backend note",
  );
});

test("every image measurement reason has a Simplified Chinese message", () => {
  const reasons: ImageMeasurementReason[] = [
    "digest_conflict",
    "size_conflict",
    "stale_inventory",
    "missing_manifest_evidence",
    "missing_size_evidence",
    "missing_manifest_size_evidence",
    "missing_blob_size_evidence",
    "missing_child_manifest",
    "missing_blob",
    "no_storage_evidence",
    "registry_not_configured",
  ];
  for (const reason of reasons) {
    const key = imageMeasurementReasonMessageKey(reason);
    assert.equal(key in zhCN, true, `missing zh-CN message for ${reason}`);
  }
});

test("complete image measurement titles ignore contradictory reasons", () => {
  assert.equal(
    fmtImageMeasurementTitle("complete", ["digest_conflict"], null, identity),
    "Image usage is based on complete storage evidence",
  );
});
