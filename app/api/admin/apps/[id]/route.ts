import { NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin/auth";
import { deleteFugueApp } from "@/lib/fugue/api";
import { getFugueEnv } from "@/lib/fugue/env";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readRouteParam,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";

type RouteContext = RouteContextWithParams<"id">;

export async function DELETE(_request: Request, context: RouteContext) {
  const access = await requireAdminApiSession();

  if (access.response) {
    return access.response;
  }

  try {
    const appId = await readRouteParam(context, "id");
    const result = await deleteFugueApp(getFugueEnv().bootstrapKey, appId);

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
