import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  requireSession,
  requireWorkspaceForSession,
} from "@/lib/fugue/product-route";
import { proxyFugueEventStream } from "@/lib/fugue/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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
    if (!url.searchParams.has("include_live_status")) {
      url.searchParams.set("include_live_status", "true");
    }

    return await proxyFugueEventStream({
      accessToken: workspaceState.workspace.adminKeySecret,
      path: `/v1/console/gallery/stream${url.search}`,
      requestHeaders: request.headers,
      signal: request.signal,
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
