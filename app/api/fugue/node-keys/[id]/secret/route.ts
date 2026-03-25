import { NextResponse } from "next/server";

import { getNodeKeyRecordById, getNodeKeySecret } from "@/lib/node-keys/store";
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

  const match = error.message.match(/\b(400|401|403|404|409|422|500|502|503)\b/);
  return match ? Number(match[1]) : 500;
}

export async function GET(
  _request: Request,
  context: RouteContextWithParams<"id">,
) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  try {
    const keyId = await readRouteParam(context, "id");
    const record = await getNodeKeyRecordById(session.email, keyId);

    if (!record) {
      return jsonError(404, "Node key not found.");
    }

    const secret = await getNodeKeySecret(session.email, keyId);

    if (!secret) {
      return jsonError(
        404,
        "Secret is unavailable. Only node keys created in fugue-web can be copied.",
      );
    }

    return NextResponse.json({
      secret,
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
