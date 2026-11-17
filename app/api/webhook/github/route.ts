import { createHash } from "node:crypto";
import { readPublicErrorStatus, sanitizePublicErrorMessage } from "@/lib/security/public-error.mjs";
import { githubAppConfiguration } from "@/lib/github/app-config";
import { githubObject, githubId, normalizeGitHubRepository, parseGitHubImageEvent, readGitHubWebhookBody, verifyGitHubSignature } from "@/lib/github/app-events";
import { enqueueGitHubImageEvent, revokeGitHubInstallation } from "@/lib/github/app-store";
import { startGitHubAppWorker, wakeGitHubAppWorker } from "@/lib/github/app-worker";

export const runtime = "nodejs";

function jsonError(status: number, message: unknown) {
  return Response.json({ error: sanitizePublicErrorMessage(message, status) }, { status });
}

export async function POST(request: Request) {
  try {
    const config = githubAppConfiguration();
    if (!config.configured) return jsonError(503, "GitHub App webhook is not configured.");
    const eventName = request.headers.get("x-github-event") ?? "";
    const deliveryId = request.headers.get("x-github-delivery") ?? "";
    if (!/^[a-z_]{1,64}$/.test(eventName) || !/^[a-zA-Z0-9-]{1,128}$/.test(deliveryId)) return jsonError(400, "Invalid GitHub webhook headers.");
    const body = await readGitHubWebhookBody(request);
    if (!verifyGitHubSignature(body, request.headers.get("x-hub-signature-256") ?? "", config.webhookSecret)) return jsonError(401, "Invalid GitHub webhook signature.");
    let payload: Record<string, unknown>;
    try { payload = githubObject(JSON.parse(body.toString("utf8"))); } catch { return jsonError(400, "Invalid GitHub webhook JSON."); }
    if (eventName === "ping") return Response.json({ accepted: true, deliveryId });
    const installationId = githubId(githubObject(payload.installation).id);
    if (installationId && eventName === "installation" && ["deleted", "suspend"].includes(String(payload.action))) {
      await revokeGitHubInstallation(installationId);
      return Response.json({ accepted: true, deliveryId });
    }
    if (installationId && eventName === "installation_repositories" && payload.action === "removed" && Array.isArray(payload.repositories_removed)) {
      const repos = payload.repositories_removed.map((repo) => normalizeGitHubRepository(String(githubObject(repo).full_name ?? "")));
      await revokeGitHubInstallation(installationId, repos);
      return Response.json({ accepted: true, deliveryId });
    }
    const event = parseGitHubImageEvent(payload, eventName, deliveryId);
    if (!event) return Response.json({ accepted: true, deliveryId, skipped: true });
    const result = await enqueueGitHubImageEvent(event, createHash("sha256").update(body).digest("hex"));
    // Acknowledge after durable commit, without waiting for registry/API latency.
    startGitHubAppWorker();
    wakeGitHubAppWorker();
    return Response.json({ accepted: true, deliveryId, ...result }, { status: 202 });
  } catch (error) { return jsonError(readPublicErrorStatus(error), error); }
}
