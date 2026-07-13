import { NextResponse } from "next/server";

import { createBillingTopupCheckoutForEmail } from "@/lib/billing/service";
import {
  isObject,
  jsonError,
  readErrorMessage,
  readErrorStatus,
  requireSession,
} from "@/lib/fugue/product-route";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";

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

    const checkout = await createBillingTopupCheckoutForEmail(session.email, {
      amountUsd: typeof body.amountUsd === "number" ? body.amountUsd : Number.NaN,
    });

    return NextResponse.json(checkout, { status: 201 });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
