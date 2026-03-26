import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readRouteParam,
  requireSession,
  requireWorkspaceForSession,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";
import { proxyFugueEventStream } from "@/lib/fugue/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = RouteContextWithParams<"id">;

export async function GET(request: Request, context: RouteContext) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  const workspaceState = await requireWorkspaceForSession(session);

  if (workspaceState.response || !workspaceState.workspace) {
    return workspaceState.response;
  }

  try {
    const url = new URL(request.url);
    const appId = await readRouteParam(context, "id");

    return await proxyFugueEventStream({
      accessToken: workspaceState.workspace.adminKeySecret,
      path: `/v1/apps/${encodeURIComponent(appId)}/build-logs/stream${url.search}`,
      requestHeaders: request.headers,
      signal: request.signal,
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
