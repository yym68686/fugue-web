import { getAppFilesystemFile, putAppFilesystemFile } from "@/lib/fugue/console";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readJsonBody,
  readOptionalString,
  readRouteParam,
  requireActiveSessionUser,
  requireWorkspaceForSession,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";
import { NextResponse } from "next/server";
import { withWorkspaceKey } from "@/lib/console/route-helpers";

export async function GET(
  request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  const search = new URL(request.url).searchParams;
  const path = search.get("path") ?? "";
  const pod = search.get("pod") ?? undefined;
  if (!path) return jsonError(400, "path is required.");

  const auth = await requireActiveSessionUser();
  if (auth.response) return auth.response;
  const ws = await requireWorkspaceForSession(auth.session);
  if (ws.response) return ws.response;

  try {
    const file = await getAppFilesystemFile(ws.workspace.adminKeySecret, id, path, { pod });
    return NextResponse.json({ ok: true, result: file });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}

export async function PUT(
  request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  const body = (await readJsonBody(request)) as Record<string, unknown> | null;
  const path = body ? readOptionalString(body, "path") : "";
  if (!path) return jsonError(400, "path is required.");
  const content = body && typeof body.content === "string" ? body.content : "";
  const pod = body ? readOptionalString(body, "pod") ?? undefined : undefined;
  return withWorkspaceKey((key) =>
    putAppFilesystemFile(
      key,
      id,
      { path, content, encoding: "utf-8", mkdir_parents: true },
      { pod },
    ),
  );
}
