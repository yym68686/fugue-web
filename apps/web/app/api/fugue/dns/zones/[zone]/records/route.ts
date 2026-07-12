import { NextResponse } from "next/server";

import {
  createFugueHostedDNSRecord,
  getFugueHostedDNSRecords,
  type FugueHostedDNSFlattenFallbackPolicy,
  type FugueHostedDNSFlattenIPPolicy,
  type FugueHostedDNSFlattenMode,
  type FugueHostedDNSFlattenTTLPolicy,
  type FugueHostedDNSRecordType,
} from "@/lib/fugue/api";
import {
  isObject,
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readOptionalString,
  readRouteParam,
  requireSession,
  requireWorkspaceForSession,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";

type RouteContext = RouteContextWithParams<"zone">;

function readOptionalNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function readOptionalBoolean(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return undefined;
}

function readValues(record: Record<string, unknown>) {
  const value = record.values;

  if (Array.isArray(value)) {
    return value.flatMap((item) =>
      typeof item === "string" && item.trim() ? [item.trim()] : [],
    );
  }

  const singleValue = readOptionalString(record, "value");
  return singleValue ? [singleValue] : [];
}

export async function GET(_request: Request, context: RouteContext) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  const workspaceState = await requireWorkspaceForSession(session);

  if (workspaceState.response || !workspaceState.workspace) {
    return workspaceState.response;
  }

  try {
    const zone = await readRouteParam(context, "zone");
    return NextResponse.json(
      await getFugueHostedDNSRecords(workspaceState.workspace.adminKeySecret, zone),
    );
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  const workspaceState = await requireWorkspaceForSession(session);

  if (workspaceState.response || !workspaceState.workspace) {
    return workspaceState.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  if (!isObject(body)) {
    return jsonError(400, "Request body must be a JSON object.");
  }

  const name = readOptionalString(body, "name");
  const type = readOptionalString(body, "type") as FugueHostedDNSRecordType;
  const values = readValues(body);

  if (!name || !type || !values.length) {
    return jsonError(400, "name, type, and values are required.");
  }

  try {
    const zone = await readRouteParam(context, "zone");
    return NextResponse.json(
      await createFugueHostedDNSRecord(workspaceState.workspace.adminKeySecret, zone, {
        flatten: readOptionalBoolean(body, "flatten"),
        flattenFallbackPolicy: readOptionalString(
          body,
          "flattenFallbackPolicy",
        ) as FugueHostedDNSFlattenFallbackPolicy,
        flattenIPv4Policy: readOptionalString(
          body,
          "flattenIPv4Policy",
        ) as FugueHostedDNSFlattenIPPolicy,
        flattenIPv6Policy: readOptionalString(
          body,
          "flattenIPv6Policy",
        ) as FugueHostedDNSFlattenIPPolicy,
        flattenMode: readOptionalString(
          body,
          "flattenMode",
        ) as FugueHostedDNSFlattenMode,
        flattenTTLPolicy: readOptionalString(
          body,
          "flattenTTLPolicy",
        ) as FugueHostedDNSFlattenTTLPolicy,
        flattenTarget: readOptionalString(body, "flattenTarget"),
        name,
        overwrite: readOptionalBoolean(body, "overwrite"),
        ttl: readOptionalNumber(body, "ttl"),
        type,
        values,
      }),
    );
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
