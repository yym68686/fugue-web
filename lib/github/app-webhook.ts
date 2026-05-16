import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { syncFugueAppImage } from "@/lib/fugue/api";
import {
  listGitHubAppImageLinksForEvent,
  normalizeGitHubRepositoryName,
  type GitHubAppImageLink,
} from "@/lib/github/app-image-links";
import { getWorkspaceAccessByEmail } from "@/lib/workspace/store";

type GitHubObject = Record<string, unknown>;

type GitHubImageEvent = {
  action: string | null;
  deliveryId: string;
  eventName: string;
  githubInstallationId: string | null;
  githubPackage: string | null;
  githubRepo: string;
  githubWorkflow: string | null;
};

type GitHubImageSyncResult = {
  appId: string;
  error?: string;
  imageRef: string;
  result?: Awaited<ReturnType<typeof syncFugueAppImage>>;
  userEmail: string;
};

function readConfiguredValue(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`503 Missing GitHub webhook environment variable: ${name}.`);
  }

  return value;
}

function asObject(value: unknown): GitHubObject | null {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? (value as GitHubObject)
    : null;
}

function readString(source: GitHubObject | null, key: string) {
  const value = source?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumberOrString(source: GitHubObject | null, key: string) {
  const value = source?.[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function verifyGitHubSignature(rawBody: Uint8Array, signature: string) {
  const expected = `sha256=${createHmac("sha256", readConfiguredValue("GITHUB_APP_WEBHOOK_SECRET"))
    .update(rawBody)
    .digest("hex")}`;
  const normalized = signature.trim().toLowerCase();

  if (expected.length !== normalized.length) {
    return false;
  }

  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(normalized, "utf8"),
    );
  } catch {
    return false;
  }
}

function extractRepository(payload: GitHubObject) {
  const repository = asObject(payload.repository);
  const fullName = readString(repository, "full_name");
  return fullName ? normalizeGitHubRepositoryName(fullName) : null;
}

function extractInstallationId(payload: GitHubObject) {
  return readNumberOrString(asObject(payload.installation), "id");
}

function extractWorkflowRunEvent(
  payload: GitHubObject,
  eventName: string,
  deliveryId: string,
): GitHubImageEvent | null {
  const workflowRun = asObject(payload.workflow_run);
  const action = readString(payload, "action");
  const status = readString(workflowRun, "status");
  const conclusion = readString(workflowRun, "conclusion");

  if (action !== "completed" && status !== "completed") {
    return null;
  }

  if (conclusion !== "success") {
    return null;
  }

  const githubRepo = extractRepository(payload);

  if (!githubRepo) {
    return null;
  }

  return {
    action,
    deliveryId,
    eventName,
    githubInstallationId: extractInstallationId(payload),
    githubPackage: null,
    githubRepo,
    githubWorkflow: readString(workflowRun, "name") ?? readString(workflowRun, "path"),
  };
}

function extractPackageEvent(
  payload: GitHubObject,
  eventName: string,
  deliveryId: string,
): GitHubImageEvent | null {
  const action = readString(payload, "action");

  if (action && !["published", "updated"].includes(action)) {
    return null;
  }

  const githubRepo = extractRepository(payload);

  if (!githubRepo) {
    return null;
  }

  return {
    action,
    deliveryId,
    eventName,
    githubInstallationId: extractInstallationId(payload),
    githubPackage: readString(asObject(payload.package), "name"),
    githubRepo,
    githubWorkflow: null,
  };
}

function extractGitHubImageEvent(
  payload: GitHubObject,
  eventName: string,
  deliveryId: string,
) {
  switch (eventName) {
    case "workflow_run":
      return extractWorkflowRunEvent(payload, eventName, deliveryId);
    case "package":
    case "registry_package":
      return extractPackageEvent(payload, eventName, deliveryId);
    default:
      return null;
  }
}

async function syncLinkedImage(link: GitHubAppImageLink, event: GitHubImageEvent) {
  const workspace = await getWorkspaceAccessByEmail(link.userEmail);

  if (!workspace) {
    return {
      appId: link.fugueAppId,
      error: "workspace not found",
      imageRef: link.imageRef,
      userEmail: link.userEmail,
    } satisfies GitHubImageSyncResult;
  }

  try {
    const result = await syncFugueAppImage(
      workspace.adminKeySecret,
      link.fugueAppId,
      {
        deliveryId: event.deliveryId,
        event: `github:${event.eventName}`,
        imageRef: link.imageRef,
      },
    );

    return {
      appId: link.fugueAppId,
      imageRef: link.imageRef,
      result,
      userEmail: link.userEmail,
    } satisfies GitHubImageSyncResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : "sync failed";

    return {
      appId: link.fugueAppId,
      error: message,
      imageRef: link.imageRef,
      userEmail: link.userEmail,
    } satisfies GitHubImageSyncResult;
  }
}

export async function processGitHubWebhookRequest(request: Request) {
  const eventName = request.headers.get("x-github-event")?.trim() ?? "";
  const deliveryId = request.headers.get("x-github-delivery")?.trim() ?? "";
  const signature = request.headers.get("x-hub-signature-256")?.trim() ?? "";

  if (!eventName || !deliveryId) {
    throw new Error("400 Missing GitHub webhook headers.");
  }

  if (!signature) {
    throw new Error("401 Missing GitHub webhook signature.");
  }

  const rawBody = new Uint8Array(await request.arrayBuffer());

  if (!verifyGitHubSignature(rawBody, signature)) {
    throw new Error("401 Invalid GitHub webhook signature.");
  }

  let payload: unknown;

  try {
    payload = JSON.parse(Buffer.from(rawBody).toString("utf8")) as unknown;
  } catch {
    throw new Error("400 Invalid JSON payload.");
  }

  const object = asObject(payload);

  if (!object) {
    throw new Error("400 Invalid JSON payload.");
  }

  if (eventName === "ping") {
    return NextResponse.json({
      accepted: true,
      deliveryId,
      eventName,
      matched: 0,
      processed: 0,
    });
  }

  const event = extractGitHubImageEvent(object, eventName, deliveryId);

  if (!event) {
    return NextResponse.json({
      accepted: true,
      deliveryId,
      eventName,
      matched: 0,
      processed: 0,
      skipped: "event is not an actionable image update signal",
    });
  }

  const links = await listGitHubAppImageLinksForEvent({
    githubInstallationId: event.githubInstallationId,
    githubPackage: event.githubPackage,
    githubRepo: event.githubRepo,
    githubWorkflow: event.githubWorkflow,
  });
  const results: GitHubImageSyncResult[] = [];

  for (const link of links) {
    results.push(await syncLinkedImage(link, event));
  }

  return NextResponse.json({
    accepted: true,
    action: event.action,
    deliveryId,
    eventName,
    githubInstallationId: event.githubInstallationId,
    githubPackage: event.githubPackage,
    githubRepo: event.githubRepo,
    githubWorkflow: event.githubWorkflow,
    matched: links.length,
    processed: results.filter((result) => !result.error).length,
    results,
  });
}
