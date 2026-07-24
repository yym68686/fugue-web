import { NextResponse } from "next/server";

import { getBillingTopupStatusForEmail } from "@/lib/billing/service";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  requireActiveSessionUser,
} from "@/lib/fugue/product-route";

function readRequestId(url: URL) {
  return url.searchParams.get("request_id") ?? url.searchParams.get("requestId");
}

/** Poll a top-up's status by request_id after returning from the Creem checkout. */
export async function GET(request: Request) {
  const auth = await requireActiveSessionUser();
  if (auth.response) return auth.response;

  const requestId = readRequestId(new URL(request.url))?.trim();

  if (!requestId) {
    return jsonError(400, "request_id is required.");
  }

  try {
    const status = await getBillingTopupStatusForEmail(auth.session.email, requestId);
    return NextResponse.json({ ok: true, result: status });
  } catch (error) {
    return jsonError(
      readErrorStatus(error),
      readErrorMessage(error).replace(/^\d{3}\s+/, ""),
    );
  }
}
