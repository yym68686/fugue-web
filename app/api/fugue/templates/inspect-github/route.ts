import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { inspectGitHubTemplate } from "@/lib/fugue/api";
import { getFugueEnv } from "@/lib/fugue/env";
import {
  isObject,
  jsonError,
  readErrorStatus,
  readOptionalString,
} from "@/lib/fugue/product-route";
import {
  isGitHubRepoUrl,
  normalizeGitHubRepoVisibility,
  resolveGitHubRepoVisibility,
} from "@/lib/github/repository";
import {
  resolveGitHubRepoAuthTokenForEmail,
} from "@/lib/github/connection-store";
import { PRIVATE_GITHUB_AUTH_REQUIRED_MESSAGE } from "@/lib/github/messages";

function normalizeTemplateInspectError(error: unknown) {
  if (!(error instanceof Error) || !error.message.trim()) {
    return "Request failed.";
  }

  return error.message
    .replace(/^Fugue request failed for [^:]+:\s*\d+\s+[A-Za-z ]+\.\s*/i, "")
    .trim();
}

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session) {
    return jsonError(401, "Sign in first.");
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
  const branch = readOptionalString(body, "branch");
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
    const repoAccess = await resolveGitHubRepoAuthTokenForEmail(session.email, {
      explicitToken: repoAuthToken,
      repoVisibility: resolvedRepoVisibility,
    });

    if (resolvedRepoVisibility === "private" && !repoAccess.token) {
      return jsonError(400, PRIVATE_GITHUB_AUTH_REQUIRED_MESSAGE);
    }

    const inspection = await inspectGitHubTemplate(getFugueEnv().bootstrapKey, {
      branch: branch || undefined,
      repoAuthToken: repoAccess.token || undefined,
      repoUrl,
      repoVisibility: resolvedRepoVisibility,
    });

    return NextResponse.json({
      inspection,
    });
  } catch (error) {
    return jsonError(
      readErrorStatus(error),
      normalizeTemplateInspectError(error),
    );
  }
}
