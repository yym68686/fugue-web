import assert from "node:assert/strict";
import test from "node:test";

import { readFugueAppObservabilityRequestOptions } from "../../lib/fugue/observability-request-query";

test("observability request filters follow the generated OpenAPI contract", () => {
  const params = new URLSearchParams({
    errors: "false",
    limit: "1000",
    request_id: "request-001",
    since: "2026-07-12T00:00:00Z",
    slow: "true",
    status_class: "5xx",
    status_code: "503",
    trace_id: "trace-001",
    until: "2026-07-12T01:00:00Z",
  });

  assert.deepEqual(readFugueAppObservabilityRequestOptions(params), {
    errors: false,
    limit: 1000,
    requestId: "request-001",
    since: "2026-07-12T00:00:00Z",
    slow: true,
    statusClass: "5xx",
    statusCode: 503,
    traceId: "trace-001",
    until: "2026-07-12T01:00:00Z",
  });
});

test("observability request filters reject values outside the contract", () => {
  const invalidCases = [
    ["limit", "0"],
    ["limit", "1001"],
    ["limit", "1.5"],
    ["status_code", "99"],
    ["status_code", "600"],
    ["status_class", "9xx"],
    ["errors", "yes"],
    ["slow", "1"],
  ] as const;

  for (const [name, value] of invalidCases) {
    assert.throws(
      () =>
        readFugueAppObservabilityRequestOptions(new URLSearchParams({ [name]: value })),
      /^Error: 400 /,
      `${name}=${value} must fail closed`,
    );
  }
});

test("observability request filters omit blank optional values", () => {
  assert.deepEqual(
    readFugueAppObservabilityRequestOptions(
      new URLSearchParams({
        errors: "",
        limit: " ",
        request_id: " ",
        status_class: "",
      }),
    ),
    {
      errors: undefined,
      limit: undefined,
      requestId: undefined,
      since: undefined,
      slow: undefined,
      statusClass: undefined,
      statusCode: undefined,
      traceId: undefined,
      until: undefined,
    },
  );
});
