import { NextResponse } from "next/server";

import { getBillingPageData, updateBillingForEmail } from "@/lib/billing/service";
import {
  isObject,
  jsonError,
  readErrorMessage,
  readErrorStatus,
  requireSession,
} from "@/lib/fugue/product-route";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";

function readWholeNumber(value: unknown, fieldLabel: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new Error(`${fieldLabel} must be a non-negative whole number.`);
  }

  return value;
}

async function readJsonObject(request: Request) {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return {} as Record<string, unknown>;
  }

  let body: unknown;

  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new Error("Invalid JSON body.");
  }

  if (!isObject(body)) {
    throw new Error("Request body must be a JSON object.");
  }

  return body;
}

export async function GET() {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  try {
    await ensureWorkspaceAccess(session);
    const data = await getBillingPageData(session.email);

    if (!data) {
      return jsonError(409, "Create a workspace first.");
    }

    return NextResponse.json(data);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}

export async function PATCH(request: Request) {
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

    const managedCap = isObject(body.managedCap) ? body.managedCap : null;

    if (!managedCap) {
      return jsonError(400, "managedCap is required.");
    }

    const billing = await updateBillingForEmail(session.email, {
      managedCap: {
        cpuMillicores: readWholeNumber(managedCap.cpuMillicores, "CPU"),
        memoryMebibytes: readWholeNumber(managedCap.memoryMebibytes, "Memory"),
      },
    });

    return NextResponse.json({ billing });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
