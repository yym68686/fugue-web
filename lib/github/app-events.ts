import { createHmac, timingSafeEqual } from "node:crypto";
import type { GitHubImageEvent } from "./app-types";

type ObjectValue = Record<string, unknown>;
export function githubObject(value: unknown): ObjectValue {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : {};
}

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

export function normalizeGitHubRepository(value: string) {
  const repo = value.trim().toLowerCase();
  if (repo.length > 201 || !/^[a-z0-9][a-z0-9_.-]*\/[a-z0-9_.-]+$/.test(repo) || repo.split("/")[1] === "." || repo.split("/")[1] === "..") {
    throw new Error("400 GitHub repository must be owner/repo.");
  }
  return repo;
}

export function githubId(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  return typeof value === "string" && /^[1-9]\d{0,19}$/.test(value) ? value : "";
}

export function verifyGitHubSignature(body: Uint8Array, signature: string, secret: string) {
  if (!secret || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function parseGitHubImageEvent(value: unknown, eventName: string, deliveryId: string): GitHubImageEvent | null {
  const payload = githubObject(value);
  const repoName = text(githubObject(payload.repository).full_name);
  const installationId = githubId(githubObject(payload.installation).id);
  if (!repoName || !installationId) return null;
  const repo = normalizeGitHubRepository(repoName);
  if (eventName === "workflow_run") {
    const run = githubObject(payload.workflow_run);
    // Only a successful completed run in this repository can signal a release.
    // Pull-request and fork workflows must never trigger a production deployment.
    if (payload.action !== "completed" || run.status !== "completed" || run.conclusion !== "success" ||
        !["push", "workflow_dispatch", "schedule", "repository_dispatch"].includes(text(run.event)) ||
        text(githubObject(run.head_repository).full_name).toLowerCase() !== repo) return null;
    const branch = text(run.head_branch);
    const workflow = text(run.name);
    const workflowPath = text(run.path).split("@")[0];
    if (!branch || (!workflow && !workflowPath)) return null;
    return { repo, installationId, workflow, workflowPath, branch, packageName: "", eventName, deliveryId };
  }
  if (["package", "registry_package"].includes(eventName) && ["published", "updated"].includes(text(payload.action))) {
    const pkg = githubObject(payload.package ?? payload.registry_package);
    const packageName = text(pkg.name);
    if (text(pkg.package_type) !== "container" || !packageName) return null;
    return { repo, installationId, packageName, workflow: "", workflowPath: "", branch: "", eventName, deliveryId };
  }
  return null;
}

export async function readGitHubWebhookBody(request: Request, limit = 2 * 1024 * 1024) {
  if (Number(request.headers.get("content-length")) > limit) throw new Error("413 GitHub webhook payload is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("400 Missing GitHub webhook body.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new Error("413 GitHub webhook payload is too large.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
