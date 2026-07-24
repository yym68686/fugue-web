import { NextResponse } from "next/server";

import { disableApiKey } from "@/lib/fugue/console";
import { resolveOwnedKey } from "@/lib/console/key-guard";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readRouteParam,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";
import { updateManagedApiKeyStatus } from "@/lib/workspace/store";

/**
 * Disable (revoke) an API key without deleting it, then mirror status='disabled'
 * locally. Reversible via the sibling /enable route.
 */
export async function POST(
  _request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  const owned = await resolveOwnedKey(id);
  if (owned.response) return owned.response;

  try {
    await disableApiKey(owned.adminKeySecret, id);
    await updateManagedApiKeyStatus({
      email: owned.email,
      fugueKeyId: id,
      status: "disabled",
    });
    return NextResponse.json({ ok: true, result: { status: "disabled" } });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
