import { NextResponse } from "next/server";

import {
  getFugueConsoleProject,
  getFugueAppImageTracking,
  putFugueAppImageTracking,
  syncFugueAppImage,
  type FugueAppImageTracking,
} from "@/lib/fugue/api";
import {
  isObject,
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readJsonBody,
  readOptionalString,
  readRouteParam,
  requireSession,
  requireWorkspaceForSession,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";
import {
  deleteGitHubAppImageLinksForProject,
  getGitHubAppImageLinkForApp,
  listGitHubAppImageLinksForProject,
  recordGitHubAppImageLinkSyncResult,
  upsertGitHubAppImageLink,
  type GitHubAppImageLink,
} from "@/lib/github/app-image-links";
import { readGitHubAppInstallationStatusForRepo } from "@/lib/github/app-installations";
import { getGitHubConnectionByEmail } from "@/lib/github/connection-store";
import {
  buildProjectImageTrackingBoundResponseView,
  buildProjectImageTrackingResponseView,
  inferProjectImageBindings,
  normalizeGitHubRepositoryInput,
} from "@/lib/github/project-image-tracking";
import {
  getGitHubProjectImageLink,
  recordGitHubProjectImageSyncResult,
  upsertGitHubProjectImageLink,
} from "@/lib/github/project-image-links";

type RouteContext = RouteContextWithParams<"id">;

function readOptionalBoolean(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

async function readAppImageTrackings(accessToken: string, appIds: string[]) {
  const results = await Promise.allSettled(
    appIds.map(async (appId) => {
      const result = await getFugueAppImageTracking(accessToken, appId);
      return result.tracking;
    }),
  );

  return results.flatMap((result): FugueAppImageTracking[] =>
    result.status === "fulfilled" && result.value ? [result.value] : [],
  );
}

async function readAppImageLinks(userEmail: string, appIds: string[]) {
  const results = await Promise.allSettled(
    appIds.map((appId) => getGitHubAppImageLinkForApp(userEmail, appId)),
  );

  return results.flatMap((result): GitHubAppImageLink[] =>
    result.status === "fulfilled" && result.value ? [result.value] : [],
  );
}

export async function GET(_request: Request, context: RouteContext) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  const workspaceState = await requireWorkspaceForSession(session);

  if (workspaceState.response || !workspaceState.workspace) {
    return workspaceState.response;
  }

  try {
    const projectId = await readRouteParam(context, "id");
    const [projectDetail, binding, links] = await Promise.all([
      getFugueConsoleProject(workspaceState.workspace.adminKeySecret, projectId),
      getGitHubProjectImageLink(session.email, projectId),
      listGitHubAppImageLinksForProject(session.email, projectId),
    ]);
    const appIds = projectDetail.apps.map((app) => app.id);
    const [appTrackings, appLinks] = await Promise.all([
      readAppImageTrackings(workspaceState.workspace.adminKeySecret, appIds),
      readAppImageLinks(session.email, appIds),
    ]);
    const githubAppInstallation = binding?.githubRepo
      ? (await readGitHubAppInstallationStatusForRepo({
          githubRepo: binding.githubRepo,
          userEmail: session.email,
        })).status
      : null;

    return NextResponse.json(
      buildProjectImageTrackingResponseView({
        appLinks,
        appTrackings,
        apps: projectDetail.apps,
        binding,
        githubAppInstallation,
        links,
        projectId,
      }),
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  const workspaceState = await requireWorkspaceForSession(session);

  if (workspaceState.response || !workspaceState.workspace) {
    return workspaceState.response;
  }

  const body = await readJsonBody(request);

  if (!isObject(body)) {
    return jsonError(400, "Request body must be a JSON object.");
  }

  const repoInput = readOptionalString(body, "githubRepo");

  if (!repoInput) {
    return jsonError(400, "githubRepo is required.");
  }

  let githubRepo: string;

  try {
    githubRepo = normalizeGitHubRepositoryInput(repoInput);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }

  try {
    const projectId = await readRouteParam(context, "id");
    const enabled = readOptionalBoolean(body, "enabled") ?? true;
    const preserveServiceOverrides =
      readOptionalBoolean(body, "preserveServiceOverrides") ?? true;
    const [projectDetail, githubConnection] = await Promise.all([
      getFugueConsoleProject(workspaceState.workspace.adminKeySecret, projectId),
      getGitHubConnectionByEmail(session.email),
    ]);
    const appIds = projectDetail.apps.map((app) => app.id);
    const [appTrackingsBefore, existingProjectLinks] = await Promise.all([
      readAppImageTrackings(workspaceState.workspace.adminKeySecret, appIds),
      listGitHubAppImageLinksForProject(session.email, projectId),
    ]);
    const projectManagedApps = new Set(
      existingProjectLinks.map((link) => link.fugueAppId),
    );
    const serviceOverrides = new Set(
      appTrackingsBefore
        .filter(
          (tracking) => tracking.enabled && !projectManagedApps.has(tracking.appId),
        )
        .map((tracking) => tracking.appId),
    );
    const githubAppInstallation = await readGitHubAppInstallationStatusForRepo({
      githubRepo,
      userEmail: session.email,
    });
    const publicRepoReady =
      githubAppInstallation.status.source === "public-repo";

    if (!githubAppInstallation.status.installed && !publicRepoReady) {
      return NextResponse.json(
        {
          error:
            githubAppInstallation.status.source === "error"
              ? "Could not verify the Fugue GitHub App installation for this repository."
              : "Install the Fugue GitHub App on this repository before binding the project.",
          githubApp: githubAppInstallation.status,
        },
        {
          status: githubAppInstallation.status.source === "error" ? 503 : 409,
        },
      );
    }

    const githubInstallationId =
      githubAppInstallation.status.githubInstallationId?.trim() ?? "";

    if (githubAppInstallation.status.installed && !githubInstallationId) {
      return NextResponse.json(
        {
          error: "GitHub App installation id is missing for this repository.",
          githubApp: githubAppInstallation.status,
        },
        {
          status: 409,
        },
      );
    }

    const inference = await inferProjectImageBindings({
      apps: projectDetail.apps,
      githubRepo,
      githubToken: githubConnection?.accessToken,
    });

    if (inference.matches.length === 0) {
      return jsonError(
        400,
        "No image-producing services could be matched from this repository.",
      );
    }

    await deleteGitHubAppImageLinksForProject(session.email, projectId);
    const binding = await upsertGitHubProjectImageLink({
      enabled,
      fugueProjectId: projectId,
      githubInstallationId,
      githubRepo,
      userEmail: session.email,
    });
    const links = await Promise.all(
      inference.matches.map(async ({ app, candidate }) => {
        if (preserveServiceOverrides && serviceOverrides.has(app.id)) {
          return null;
        }

        await putFugueAppImageTracking(
          workspaceState.workspace.adminKeySecret,
          app.id,
          {
            enabled,
            imageRef: candidate.imageRef,
          },
        );

        const link = await upsertGitHubAppImageLink({
          enabled,
          fugueAppId: app.id,
          fugueProjectId: projectId,
          githubInstallationId,
          githubRepo,
          imageRef: candidate.imageRef,
          userEmail: session.email,
        });

        if (enabled) {
          const deliveryId = "project-bind";

          try {
            await syncFugueAppImage(
              workspaceState.workspace.adminKeySecret,
              app.id,
              {
                event: "github:project-bind",
                imageRef: candidate.imageRef,
              },
            );

            await recordGitHubAppImageLinkSyncResult({
              deliveryId,
              fugueAppId: app.id,
              githubInstallationId,
            }).catch(() => null);

            await recordGitHubProjectImageSyncResult({
              deliveryId,
              githubInstallationId,
              githubRepo,
              userEmail: session.email,
            }).catch(() => null);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "image sync failed";

            await recordGitHubAppImageLinkSyncResult({
              deliveryId,
              error: message,
              fugueAppId: app.id,
              githubInstallationId,
            }).catch(() => null);

            await recordGitHubProjectImageSyncResult({
              deliveryId,
              error: message,
              githubInstallationId,
              githubRepo,
              userEmail: session.email,
            }).catch(() => null);
          }
        }

        return link;
      }),
    );
    const savedLinks = links.filter((link): link is GitHubAppImageLink =>
      Boolean(link),
    );
    const [nextBinding, nextLinks] = await Promise.all([
      getGitHubProjectImageLink(session.email, projectId),
      listGitHubAppImageLinksForProject(session.email, projectId),
    ]);
    const [appTrackings, appLinks] = await Promise.all([
      readAppImageTrackings(workspaceState.workspace.adminKeySecret, appIds),
      readAppImageLinks(session.email, appIds),
    ]);

    return NextResponse.json(
      buildProjectImageTrackingBoundResponseView({
        appLinks,
        appTrackings,
        apps: projectDetail.apps,
        binding: nextBinding ?? binding,
        githubAppInstallation: githubAppInstallation.status,
        links: nextLinks.length ? nextLinks : savedLinks,
        matches: inference.matches,
        projectId,
      }),
    );
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
