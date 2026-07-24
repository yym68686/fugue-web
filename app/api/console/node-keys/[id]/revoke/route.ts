import { NextResponse } from "next/server";

import { revokeNodeKey } from "@/lib/fugue/console";
import { resolveOwnedNodeKey } from "@/lib/console/key-guard";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readRouteParam,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";
import { revokeManagedNodeKey } from "@/lib/workspace/store";

/**
 * Revoke (disable) a node-enrollment key, then mirror status='revoked' locally.
 * Any VPS already enrolled with it is cleaned up by the backend.
 */
export async function POST(
  _request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  const owned = await resolveOwnedNodeKey(id);
  if (owned.response) return owned.response;

  try {
    await revokeNodeKey(owned.adminKeySecret, id);
    await revokeManagedNodeKey({ email: owned.email, nodeKeyId: id });
    return NextResponse.json({ ok: true, result: { status: "revoked" } });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
