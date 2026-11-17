import "server-only";
import { fugueSend, fugueGet, type ConsoleAppDetail } from "@/lib/fugue/console";
import type { components } from "@/lib/fugue/openapi.generated";
import { getWorkspaceAccessByEmail } from "@/lib/workspace/store";
import { readPublicErrorStatus } from "@/lib/security/public-error.mjs";
import { githubAppConfiguration } from "./app-config";
import { verifyRepositoryInstallation } from "./app-api";
import { claimGitHubJob, currentGitHubJobLink, finishGitHubJob, renewGitHubJobLease, pruneGitHubAppHistory, type ClaimedGitHubJob } from "./app-store";

declare global {
  var __fugueGitHubWorker: { timer: ReturnType<typeof setInterval>; running: Promise<void> | null } | undefined;
}

export function githubSyncDisposition(result: components["schemas"]["AppImageSyncResponse"]) {
  if (result.changed || result.already_current) return "completed" as const;
  // 202 with an active operation does not mean this notification was queued.
  return "pending" as const;
}

export async function dispatchGitHubJob(job: ClaimedGitHubJob) {
  let stage = "binding";
  try {
    const link = await currentGitHubJobLink(job);
    if (!link) return await finishGitHubJob(job, { status: "cancelled" });
    stage = "workspace";
    const workspace = await getWorkspaceAccessByEmail(link.user_email);
    if (!workspace) return await finishGitHubJob(job, { status: "cancelled", error: "Workspace is no longer available." });
    stage = "github_verification";
    await verifyRepositoryInstallation(link.user_email, link.github_repo, link.github_installation_id, job.event_name);
    const path = `/v1/apps/${encodeURIComponent(link.fugue_app_id)}`;
    // Use the tenant-scoped key from the current workspace, never bootstrap auth.
    stage = "app_verification";
    const data = await fugueGet<{ app: ConsoleAppDetail }>(workspace.adminKeySecret, path, { signal: AbortSignal.timeout(30_000) });
    if (data.app.tenant_id !== workspace.tenantId) throw new Error("403 Workspace no longer owns this service.");
    if (data.app.spec?.replicas === 0) {
      throw new Error("409 Service is paused; image notification is waiting.");
    }
    if (!await currentGitHubJobLink(job)) return await finishGitHubJob(job, { status: "cancelled" });
    if (!await renewGitHubJobLease(job)) return;
    stage = "image_sync";
    const result = await fugueSend<components["schemas"]["AppImageSyncResponse"]>(workspace.adminKeySecret, "POST", `${path}/image-sync`, {
      image_ref: link.image_ref, event: `github:${job.event_name}`, delivery_id: job.delivery_id,
    }, { signal: AbortSignal.timeout(30_000) });
    const status = githubSyncDisposition(result);
    const finalStatus = status === "pending" && job.attempts >= 12 ? "failed" : status;
    await finishGitHubJob(job, {
      status: finalStatus,
      operationId: result.operation?.id,
      error: finalStatus === "failed" ? "An operation is still in progress and the retry limit was reached. Retry the notification manually." :
        status === "pending" ? "An operation is already in progress; notification will be retried." : "",
    });
    console.info(JSON.stringify({ event: "github_app_image_sync", job_id: job.id, status: finalStatus, operation_id: result.operation?.id ?? "" }));
  } catch (error) {
    const status = job.attempts >= 12 ? "failed" : "pending";
    // Backend errors can include private URLs. Persist only a safe category.
    const code = String(readPublicErrorStatus(error));
    const reason = error instanceof Error && error.message.startsWith("409 Service is paused") ? "Service is paused; image notification is waiting." :
      stage === "github_verification" ? "GitHub repository access or App installation verification failed. Check the connection, permissions and release event subscription." :
      code === "403" || code === "401" ? "Fugue deployment permission verification failed." :
      code === "409" ? "Image tracking changed or an operation is in progress. Check the service settings." :
      "GitHub image notification could not be dispatched. Check installation and image tracking settings.";
    await finishGitHubJob(job, { status, error: reason });
    console.error(JSON.stringify({ event: "github_app_image_sync", job_id: job.id, status, category: "dispatch_failed", stage, code }));
  }
}

async function drain() {
  // Bounded batches and DB leases allow multiple Web replicas and crash recovery.
  for (let n = 0; n < 4; n++) {
    const job = await claimGitHubJob();
    if (!job) break;
    await dispatchGitHubJob(job);
  }
  await pruneGitHubAppHistory();
}

export function wakeGitHubAppWorker() {
  const state = globalThis.__fugueGitHubWorker;
  if (!state || state.running || !githubAppConfiguration().configured) return;
  state.running = drain().catch(() => {
    console.error(JSON.stringify({ event: "github_app_worker", category: "queue_unavailable" }));
  }).finally(() => { state.running = null; });
}

export function startGitHubAppWorker() {
  if (!githubAppConfiguration().configured || globalThis.__fugueGitHubWorker) return;
  const timer = setInterval(wakeGitHubAppWorker, 15_000);
  timer.unref();
  globalThis.__fugueGitHubWorker = { timer, running: null };
  wakeGitHubAppWorker();
}
