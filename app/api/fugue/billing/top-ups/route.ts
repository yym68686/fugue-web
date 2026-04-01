import { NextResponse } from "next/server";

import { topUpBillingForEmail } from "@/lib/billing/service";
import {
  isObject,
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readOptionalString,
  requireSession,
} from "@/lib/fugue/product-route";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";

function readPositiveWholeNumber(value: unknown, fieldLabel: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
    throw new Error(`${fieldLabel} must be a positive whole number.`);
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

export async function POST(request: Request) {
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

    const billing = await topUpBillingForEmail(session.email, {
      amountCents: readPositiveWholeNumber(body.amountCents, "amountCents"),
      note: readOptionalString(body, "note") || undefined,
    });

    return NextResponse.json({ billing }, { status: 201 });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
