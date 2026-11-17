import "server-only";
import { fugueGet, type ConsoleAppDetail } from "@/lib/fugue/console";
import type { components } from "@/lib/fugue/openapi.generated";
import type { GitHubImageSettings } from "./app-types";
import { githubAppConfiguration, requireGitHubAppConfiguration } from "./app-config";
import { normalizeGitHubRepository } from "./app-events";
import { getGitHubConnectionSnapshotByEmail } from "./connection-store";
import { verifyRepositoryInstallation } from "./app-api";
import { getGitHubImageLink, listGitHubImageJobs, saveGitHubImageLink } from "./app-store";

export async function githubImageSettings(email: string, key: string, appId: string): Promise<GitHubImageSettings> {
  const path = `/v1/apps/${encodeURIComponent(appId)}`;
  // Always authorize the app before reading any product-layer link or jobs.
  await fugueGet<{ app: ConsoleAppDetail }>(key, path, { signal: AbortSignal.timeout(30_000) });
  const [tracking, link, jobs, connection] = await Promise.all([
    fugueGet<components["schemas"]["AppImageTrackingResponse"]>(key, `${path}/image-tracking`, { signal: AbortSignal.timeout(30_000) }),
    getGitHubImageLink(email, appId), listGitHubImageJobs(email, appId), getGitHubConnectionSnapshotByEmail(email),
  ]);
  return { configured: githubAppConfiguration().configured, githubConnected: Boolean(connection), link, jobs,
    imageRef: tracking.tracking?.image_ref ?? null, trackingEnabled: tracking.tracking?.enabled === true };
}

export function readGitHubLinkInput(input: Record<string, unknown>) {
  const field = (name: string, fallback = "") => {
    if (input[name] === undefined) return fallback;
    if (typeof input[name] !== "string" || (input[name] as string).length > 255 || /[\x00-\x1f\x7f]/.test(input[name] as string)) throw new Error(`400 Invalid ${name}.`);
    return (input[name] as string).trim();
  };
  const repo = normalizeGitHubRepository(field("githubRepo"));
  const workflow = field("githubWorkflow");
  const branch = field("githubBranch", "main");
  const packageName = field("githubPackage");
  if (packageName ? Boolean(branch || workflow) : !branch) throw new Error("400 Package notifications require a package name and empty branch/workflow filters.");
  return { repo, workflow, branch, packageName };
}

export async function bindGitHubImage(email: string, key: string, appId: string, input: Record<string, unknown>) {
  requireGitHubAppConfiguration();
  const fields = readGitHubLinkInput(input);
  const path = `/v1/apps/${encodeURIComponent(appId)}`;
  const { app } = await fugueGet<{ app: ConsoleAppDetail }>(key, path, { signal: AbortSignal.timeout(30_000) });
  const tracking = await fugueGet<components["schemas"]["AppImageTrackingResponse"]>(key, `${path}/image-tracking`, { signal: AbortSignal.timeout(30_000) });
  if (!tracking.tracking?.enabled || !tracking.tracking.image_ref) throw new Error("409 Enable external image tracking for this service first.");
  const installation = await verifyRepositoryInstallation(email, fields.repo, undefined, fields.packageName ? "registry_package" : "workflow_run");
  return saveGitHubImageLink({ email, appId, projectId: app.project_id ?? "", imageRef: tracking.tracking.image_ref,
    ...fields, installationId: installation.id, accountLogin: installation.accountLogin, repositorySelection: installation.repositorySelection });
}
