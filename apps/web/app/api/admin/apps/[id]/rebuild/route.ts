import { NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin/auth";
import { invalidateAdminAppsPageData } from "@/lib/admin/service";
import { rebuildFugueApp } from "@/lib/fugue/api";
import { getFugueEnv } from "@/lib/fugue/env";
import {
  jsonError,
  type RouteContextWithParams,
  readErrorMessage,
  readErrorStatus,
  readRouteParam,
} from "@/lib/fugue/product-route";
import { runAuditedOutboundAdminMutation } from "@/lib/security/audit";

type RouteContext = RouteContextWithParams<"id">;

export async function POST(_request: Request, context: RouteContext) {
  const access = await requireAdminApiSession();

  if (access.response) {
    return access.response;
  }

  try {
    const appId = await readRouteParam(context, "id");
    const result = await runAuditedOutboundAdminMutation(
      {
        actorEmail: access.session.email,
        appId,
        kind: "app.rebuild",
      },
      () => rebuildFugueApp(getFugueEnv().bootstrapKey, appId),
    );
    invalidateAdminAppsPageData();

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
