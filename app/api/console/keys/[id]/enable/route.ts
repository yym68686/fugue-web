import { NextResponse } from "next/server";

import { enableApiKey } from "@/lib/fugue/console";
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
 * Re-enable a previously disabled API key, then mirror status='active' locally
 * (which also clears disabled_at).
 */
export async function POST(
  _request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  const owned = await resolveOwnedKey(id);
  if (owned.response) return owned.response;

  try {
    await enableApiKey(owned.adminKeySecret, id);
    await updateManagedApiKeyStatus({
      email: owned.email,
      fugueKeyId: id,
      status: "active",
    });
    return NextResponse.json({ ok: true, result: { status: "active" } });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
