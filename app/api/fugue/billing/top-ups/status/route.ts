import { NextResponse } from "next/server";

import { getBillingTopupStatusForEmail } from "@/lib/billing/service";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  requireSession,
} from "@/lib/fugue/product-route";

function readRequestId(url: URL) {
  return url.searchParams.get("request_id") ?? url.searchParams.get("requestId");
}

export async function GET(request: Request) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  const requestId = readRequestId(new URL(request.url))?.trim();

  if (!requestId) {
    return jsonError(400, "request_id is required.");
  }

  try {
    const status = await getBillingTopupStatusForEmail(session.email, requestId);
    return NextResponse.json(status);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
