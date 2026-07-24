import { NextResponse } from "next/server";

import { createBillingTopupCheckoutForEmail } from "@/lib/billing/service";
import {
  isObject,
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readJsonBody,
  requireActiveSessionUser,
} from "@/lib/fugue/product-route";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";

/**
 * Start a Creem checkout for a credit top-up.
 *
 * Guards on an active session, then ensures the caller has a provisioned
 * workspace (so brand-new users who never triggered provisioning can still
 * pay). Returns `{ checkoutUrl, requestId }`; the browser redirects to
 * `checkoutUrl` and later returns to /billing?request_id=... to poll status.
 */
export async function POST(request: Request) {
  const auth = await requireActiveSessionUser();
  if (auth.response) return auth.response;

  const body = (await readJsonBody(request)) as Record<string, unknown> | null;
  if (body !== null && !isObject(body)) {
    return jsonError(400, "Request body must be a JSON object.");
  }

  try {
    await ensureWorkspaceAccess(auth.session);

    const checkout = await createBillingTopupCheckoutForEmail(auth.session.email, {
      amountUsd:
        body && typeof body.amountUsd === "number" ? body.amountUsd : Number.NaN,
    });

    return NextResponse.json({ ok: true, result: checkout }, { status: 201 });
  } catch (error) {
    // Service errors embed their status inline (`4xx ...`); strip that prefix
    // from the message shown to the client.
    return jsonError(
      readErrorStatus(error),
      readErrorMessage(error).replace(/^\d{3}\s+/, ""),
    );
  }
}
