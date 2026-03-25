import { NextResponse } from "next/server";

import { revokeNodeKeyForEmail } from "@/lib/node-keys/service";
import {
  jsonError,
  readErrorMessage,
  readRouteParam,
  requireSession,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";

function readErrorStatus(error: unknown) {
  if (!(error instanceof Error)) {
    return 500;
  }

  if (
    error.message.includes("workspace") ||
    error.message.includes("Create a workspace")
  ) {
    return 409;
  }

  if (error.message.includes("not found")) {
    return 404;
  }

  const match = error.message.match(/\b(400|401|403|404|409|422|500|502|503)\b/);
  return match ? Number(match[1]) : 500;
}

export async function POST(
  _request: Request,
  context: RouteContextWithParams<"id">,
) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  try {
    const revoked = await revokeNodeKeyForEmail(
      session.email,
      await readRouteParam(context, "id"),
    );

    return NextResponse.json(revoked);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
