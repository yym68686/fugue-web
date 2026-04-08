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
    const referenceBundle = isObject(body.reference_bundle)
      ? body.reference_bundle
      : null;
    const sharing = await setRuntimePublicOfferForEmail(
      session.email,
      runtimeId,
      {
        free: typeof body.free === "boolean" ? body.free : undefined,
        freeCpu: typeof body.free_cpu === "boolean" ? body.free_cpu : undefined,
        freeMemory:
          typeof body.free_memory === "boolean" ? body.free_memory : undefined,
        freeStorage:
          typeof body.free_storage === "boolean"
            ? body.free_storage
            : undefined,
        referenceBundle: referenceBundle
          ? {
              cpuMillicores: readOptionalNumber(referenceBundle.cpu_millicores),
              memoryMebibytes: readOptionalNumber(
                referenceBundle.memory_mebibytes,
              ),
              storageGibibytes: readOptionalNumber(
                referenceBundle.storage_gibibytes,
              ),
            }
          : undefined,
        referenceMonthlyPriceMicroCents: readOptionalNumber(
          body.reference_monthly_price_microcents,
        ),
      },
    );

    return NextResponse.json({ sharing });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
