import { NextResponse } from "next/server";

import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readRouteParam,
  requireActiveSessionUser,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";
import { getApiKeySecretForUser } from "@/lib/workspace/store";

// POST prevents link prefetching; secrets never enter the page's RSC payload.
export async function POST(_request: Request, context: RouteContextWithParams<"id">) {
  try {
    const auth = await requireActiveSessionUser();
    if (auth.response) return auth.response;

    const id = await readRouteParam(context, "id");
    const key = await getApiKeySecretForUser(auth.session.email, id);
    if (!key.found) return jsonError(404, "Key not found.");
    if (!key.secret) {
      return jsonError(409, "This key's secret was not saved. Create a new key to copy it.");
    }

    return NextResponse.json(
      { ok: true, result: { secret: key.secret } },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
