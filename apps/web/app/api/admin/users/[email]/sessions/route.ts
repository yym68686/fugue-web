import { NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin/auth";
import { invalidateAdminUsersPageEnrichmentData } from "@/lib/admin/service";
import { revokeAppUserSessions } from "@/lib/app-users/store";
import { invalidateCachedWorkspaceAccessByEmail } from "@/lib/server/session-state-cache";
import {
  jsonError,
  type RouteContextWithParams,
  readErrorMessage,
  readErrorStatus,
  readRouteParam,
} from "@/lib/fugue/product-route";

type RouteContext = RouteContextWithParams<"email">;

export async function POST(_request: Request, context: RouteContext) {
  const access = await requireAdminApiSession();

  if (access.response) {
    return access.response;
  }

  try {
    const email = await readRouteParam(context, "email");
    const user = await revokeAppUserSessions(email, {
      actorEmail: access.session.email,
      reason: "admin-forced-logout",
    });

    invalidateCachedWorkspaceAccessByEmail(email);
    invalidateAdminUsersPageEnrichmentData();
    return NextResponse.json({ user });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
