import { NextResponse } from "next/server";

import { patchFugueAppSource } from "@/lib/fugue/api";
import {
  isGitHubRepoUrl,
  normalizeGitHubRepoVisibility,
  resolveGitHubRepoVisibility,
} from "@/lib/github/repository";
import { resolveGitHubRepoAuthTokenForEmail } from "@/lib/github/connection-store";
import { PRIVATE_GITHUB_AUTH_REQUIRED_MESSAGE } from "@/lib/github/messages";
import {
  isObject,
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readOptionalString,
  readRouteParam,
  requireSession,
  requireWorkspaceForSession,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";

type RouteContext = RouteContextWithParams<"id">;

export async function PATCH(request: Request, context: RouteContext) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  const workspaceState = await requireWorkspaceForSession(session);

  if (workspaceState.response || !workspaceState.workspace) {
    return workspaceState.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  if (!isObject(body)) {
    return jsonError(400, "Request body must be a JSON object.");
  }

  const repoUrl = readOptionalString(body, "repoUrl");
  const repoBranch = readOptionalString(body, "repoBranch");
  const repoVisibilityInput = readOptionalString(body, "repoVisibility");
  const repoVisibility = normalizeGitHubRepoVisibility(repoVisibilityInput);
  const repoAuthToken = readOptionalString(body, "repoAuthToken");
  const resolvedRepoVisibility = resolveGitHubRepoVisibility(
    repoVisibilityInput,
    Boolean(repoAuthToken),
  );

  if (!repoUrl) {
    return jsonError(400, "Repository link is required.");
  }

  if (!isGitHubRepoUrl(repoUrl)) {
    return jsonError(
      400,
      "GitHub repository links must use https://github.com/owner/repo.",
    );
  }

  if (repoVisibilityInput && !repoVisibility) {
    return jsonError(400, "Repository access must be public or private.");
  }

  try {
    const appId = await readRouteParam(context, "id");
    const repoAccess = await resolveGitHubRepoAuthTokenForEmail(session.email, {
      explicitToken: repoAuthToken,
      repoVisibility: resolvedRepoVisibility,
    });

    if (resolvedRepoVisibility === "private" && !repoAccess.token) {
      return jsonError(400, PRIVATE_GITHUB_AUTH_REQUIRED_MESSAGE);
    }

    const result = await patchFugueAppSource(
      workspaceState.workspace.adminKeySecret,
      appId,
      {
        repoAuthToken: repoAccess.token || undefined,
        repoBranch: repoBranch || undefined,
        repoUrl,
        repoVisibility: resolvedRepoVisibility,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
