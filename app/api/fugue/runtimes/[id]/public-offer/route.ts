import { NextResponse } from "next/server";

import {
  isObject,
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readRouteParam,
  requireSession,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";
import { setRuntimePublicOfferForEmail } from "@/lib/runtimes/service";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";

type RouteContext = RouteContextWithParams<"id">;

function readOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function readOptionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function readOptionalPayloadNumber(
  body: Record<string, unknown>,
  snakeCaseKey: string,
  camelCaseKey: string,
) {
  return (
    readOptionalNumber(body[snakeCaseKey]) ??
    readOptionalNumber(body[camelCaseKey])
  );
}

function readOptionalPayloadBoolean(
  body: Record<string, unknown>,
  snakeCaseKey: string,
  camelCaseKey: string,
) {
  return (
    readOptionalBoolean(body[snakeCaseKey]) ??
    readOptionalBoolean(body[camelCaseKey])
  );
}

function readOptionalPayloadObject(
  body: Record<string, unknown>,
  snakeCaseKey: string,
  camelCaseKey: string,
) {
  const snakeCaseValue = body[snakeCaseKey];

  if (isObject(snakeCaseValue)) {
    return snakeCaseValue;
  }

  const camelCaseValue = body[camelCaseKey];
  return isObject(camelCaseValue) ? camelCaseValue : null;
}

async function readJsonObject(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new Error("400 Invalid JSON body.");
  }

  if (!isObject(body)) {
    throw new Error("400 Request body must be a JSON object.");
  }

  return body;
}

export async function POST(request: Request, context: RouteContext) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  let body: Record<string, unknown>;

  try {
    body = await readJsonObject(request);
  } catch (error) {
    return jsonError(400, readErrorMessage(error));
  }

  try {
    await ensureWorkspaceAccess(session);
    const runtimeId = await readRouteParam(context, "id");
    const referenceBundle = readOptionalPayloadObject(
      body,
      "reference_bundle",
      "referenceBundle",
    );
    const sharing = await setRuntimePublicOfferForEmail(
      session.email,
      runtimeId,
      {
        free: readOptionalBoolean(body.free),
        freeCpu: readOptionalPayloadBoolean(body, "free_cpu", "freeCpu"),
        freeMemory: readOptionalPayloadBoolean(
          body,
          "free_memory",
          "freeMemory",
        ),
        freeStorage: readOptionalPayloadBoolean(
          body,
          "free_storage",
          "freeStorage",
        ),
        referenceBundle: referenceBundle
          ? {
              cpuMillicores:
                readOptionalNumber(referenceBundle.cpu_millicores) ??
                readOptionalNumber(referenceBundle.cpuMillicores),
              memoryMebibytes:
                readOptionalNumber(referenceBundle.memory_mebibytes) ??
                readOptionalNumber(referenceBundle.memoryMebibytes),
              storageGibibytes:
                readOptionalNumber(referenceBundle.storage_gibibytes) ??
                readOptionalNumber(referenceBundle.storageGibibytes),
            }
          : undefined,
        referenceMonthlyPriceMicroCents: readOptionalPayloadNumber(
          body,
          "reference_monthly_price_microcents",
          "referenceMonthlyPriceMicroCents",
        ),
      },
    );

    return NextResponse.json({ sharing });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
