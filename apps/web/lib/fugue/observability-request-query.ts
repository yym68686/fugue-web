import type { paths } from "@/lib/fugue/openapi.generated";

type GeneratedObservabilityRequestQuery = NonNullable<
  paths["/v1/apps/{id}/observability/requests"]["get"]["parameters"]["query"]
>;

export type FugueAppObservabilityRequestOptions = {
  errors?: GeneratedObservabilityRequestQuery["errors"];
  limit?: GeneratedObservabilityRequestQuery["limit"];
  requestId?: GeneratedObservabilityRequestQuery["request_id"];
  since?: GeneratedObservabilityRequestQuery["since"];
  slow?: GeneratedObservabilityRequestQuery["slow"];
  statusClass?: GeneratedObservabilityRequestQuery["status_class"];
  statusCode?: GeneratedObservabilityRequestQuery["status_code"];
  traceId?: GeneratedObservabilityRequestQuery["trace_id"];
  until?: GeneratedObservabilityRequestQuery["until"];
};

const STATUS_CLASSES = new Set<
  NonNullable<GeneratedObservabilityRequestQuery["status_class"]>
>(["1xx", "2xx", "3xx", "4xx", "5xx"]);

function readOptionalString(value: string | null) {
  const normalized = value?.trim();
  return normalized || undefined;
}

function readOptionalBoolean(value: string | null, parameter: string) {
  if (value === null || value.trim() === "") {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`400 ${parameter} must be true or false.`);
}

function readOptionalInteger(
  value: string | null,
  parameter: string,
  minimum: number,
  maximum: number,
) {
  if (value === null || value.trim() === "") {
    return undefined;
  }

  const normalized = value.trim();

  if (!/^\d+$/.test(normalized)) {
    throw new Error(`400 ${parameter} must be between ${minimum} and ${maximum}.`);
  }

  const parsed = Number(normalized);

  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`400 ${parameter} must be between ${minimum} and ${maximum}.`);
  }

  return parsed;
}

function readStatusClass(
  value: string | null,
): GeneratedObservabilityRequestQuery["status_class"] {
  const normalized = readOptionalString(value);

  if (!normalized) {
    return undefined;
  }

  if (
    STATUS_CLASSES.has(
      normalized as NonNullable<GeneratedObservabilityRequestQuery["status_class"]>,
    )
  ) {
    return normalized as NonNullable<
      GeneratedObservabilityRequestQuery["status_class"]
    >;
  }

  throw new Error("400 status_class must be one of 1xx, 2xx, 3xx, 4xx, or 5xx.");
}

export function readFugueAppObservabilityRequestOptions(
  searchParams: URLSearchParams,
): FugueAppObservabilityRequestOptions {
  return {
    errors: readOptionalBoolean(searchParams.get("errors"), "errors"),
    limit: readOptionalInteger(searchParams.get("limit"), "limit", 1, 1_000),
    requestId: readOptionalString(searchParams.get("request_id")),
    since: readOptionalString(searchParams.get("since")),
    slow: readOptionalBoolean(searchParams.get("slow"), "slow"),
    statusClass: readStatusClass(searchParams.get("status_class")),
    statusCode: readOptionalInteger(
      searchParams.get("status_code"),
      "status_code",
      100,
      599,
    ),
    traceId: readOptionalString(searchParams.get("trace_id")),
    until: readOptionalString(searchParams.get("until")),
  };
}
