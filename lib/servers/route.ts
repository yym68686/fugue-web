import "server-only";
import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/fugue/console";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  requireActiveSessionUser,
  requireWorkspaceForSession,
} from "@/lib/fugue/product-route";
import { fail, type ServerActor } from "@/lib/servers/access";

export async function withServerActor<T>(
  action: (actor: ServerActor) => Promise<T>,
) {
  const auth = await requireActiveSessionUser();
  if (auth.response) return auth.response;
  const ws = await requireWorkspaceForSession(auth.session);
  if (ws.response) return ws.response;
  try {
    const context = await getAuthContext(ws.workspace.adminKeySecret);
    if (context.tenantId !== ws.workspace.tenantId)
      fail(403, "Workspace access could not be verified.");
    const result = await action({
      email: auth.session.email,
      tenantId: ws.workspace.tenantId,
      key: ws.workspace.adminKeySecret,
      scopes: context.scopes,
      isAdmin: Boolean(auth.user?.isAdmin),
    });
    return NextResponse.json(
      { ok: true, result },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}

export async function readActionBody(
  request: Request,
): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Invalid request body.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return fail(400, "Invalid request body.");
  return body as Record<string, unknown>;
}
