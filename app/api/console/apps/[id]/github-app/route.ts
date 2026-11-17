import { NextResponse } from "next/server";
import { fugueGet } from "@/lib/fugue/console";
import { jsonError, readErrorMessage, readErrorStatus, readRouteParam, requireActiveSessionUser, requireWorkspaceForSession, type RouteContextWithParams } from "@/lib/fugue/product-route";
import { bindGitHubImage, githubImageSettings } from "@/lib/github/app-service";
import { disableGitHubImageLink, retryGitHubImageJobs } from "@/lib/github/app-store";
import { wakeGitHubAppWorker } from "@/lib/github/app-worker";
import { readRequestOrigin } from "@/lib/auth/origin";
import { readGitHubWebhookBody } from "@/lib/github/app-events";

async function handle(request: Request, context: RouteContextWithParams<"id">) {
  const auth = await requireActiveSessionUser();
  if (auth.response) return auth.response;
  const ws = await requireWorkspaceForSession(auth.session);
  if (ws.response) return ws.response;
  const id = await readRouteParam(context, "id");
  const key = ws.workspace.adminKeySecret;
  try {
    if (request.method !== "GET" && request.headers.get("origin") !== readRequestOrigin(request)) return jsonError(403, "Request was rejected. Refresh and try again.");
    if (request.method === "PUT") {
      let body: unknown;
      const bytes = await readGitHubWebhookBody(request, 16 * 1024);
      try { body = JSON.parse(bytes.toString("utf8")); } catch { return jsonError(400, "Invalid request body."); }
      if (!body || typeof body !== "object" || Array.isArray(body)) return jsonError(400, "Invalid request body.");
      await bindGitHubImage(auth.session.email, key, id, body as Record<string, unknown>);
    } else if (request.method !== "GET") {
      await fugueGet(key, `/v1/apps/${encodeURIComponent(id)}`);
      if (request.method === "DELETE") await disableGitHubImageLink(auth.session.email, id);
      else { await retryGitHubImageJobs(auth.session.email, id); wakeGitHubAppWorker(); }
    }
    return NextResponse.json({ ok: true, result: await githubImageSettings(auth.session.email, key, id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(readErrorStatus(error), readErrorMessage(error)); }
}

export const GET = handle;
export const PUT = handle;
export const DELETE = handle;
export const POST = handle;
