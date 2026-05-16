import { NextResponse } from "next/server";

import {
  getFugueAppImageTracking,
  putFugueAppImageTracking,
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
  getGitHubAppImageLinkForApp,
  upsertGitHubAppImageLink,
} from "@/lib/github/app-image-links";

type RouteContext = RouteContextWithParams<"id">;

function readOptionalBoolean(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
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
    const appId = await readRouteParam(context, "id");
    const [tracking, githubLink] = await Promise.all([
      getFugueAppImageTracking(workspaceState.workspace.adminKeySecret, appId),
      getGitHubAppImageLinkForApp(session.email, appId),
    ]);

    return NextResponse.json({
      ...tracking,
      githubLink,
    });
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

  const imageRef = readOptionalString(body, "imageRef");

  if (!imageRef) {
    return jsonError(400, "imageRef is required.");
  }

  const enabled = readOptionalBoolean(body, "enabled") ?? true;
  const githubRepo = readOptionalString(body, "githubRepo");
  const githubWorkflow = readOptionalString(body, "githubWorkflow");
  const githubPackage = readOptionalString(body, "githubPackage");
  const githubInstallationId = readOptionalString(body, "githubInstallationId");

  try {
    const appId = await readRouteParam(context, "id");
    const tracking = await putFugueAppImageTracking(
      workspaceState.workspace.adminKeySecret,
      appId,
      {
        enabled,
        imageRef,
      },
    );

    const existingLink = await getGitHubAppImageLinkForApp(session.email, appId);
    const shouldPersistLink = Boolean(githubRepo || existingLink);
    const githubLink = shouldPersistLink
      ? await upsertGitHubAppImageLink({
          enabled,
          fugueAppId: appId,
          githubInstallationId:
            githubInstallationId || existingLink?.githubInstallationId,
          githubPackage: githubPackage || existingLink?.githubPackage,
          githubRepo: githubRepo || existingLink?.githubRepo || "",
          githubWorkflow: githubWorkflow || existingLink?.githubWorkflow,
          imageRef,
          userEmail: session.email,
        })
      : null;

    return NextResponse.json({
      ...tracking,
      githubLink,
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
