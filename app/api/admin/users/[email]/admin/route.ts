import { NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin/auth";
import { invalidateAdminUsersPageEnrichmentData } from "@/lib/admin/service";
import { setAppUserAdmin } from "@/lib/app-users/store";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readRouteParam,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";

type RouteContext = RouteContextWithParams<"email">;

export async function POST(_request: Request, context: RouteContext) {
  const access = await requireAdminApiSession();

  if (access.response) {
    return access.response;
  }

  try {
    const email = await readRouteParam(context, "email");
    const user = await setAppUserAdmin(email, true);

    invalidateAdminUsersPageEnrichmentData();
    return NextResponse.json({
      user,
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const access = await requireAdminApiSession();

  if (access.response) {
    return access.response;
  }

  try {
    const email = await readRouteParam(context, "email");
    const user = await setAppUserAdmin(email, false);

    invalidateAdminUsersPageEnrichmentData();
    return NextResponse.json({
      user,
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
