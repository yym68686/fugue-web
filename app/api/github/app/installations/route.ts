import { NextResponse } from "next/server";

import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  requireSession,
} from "@/lib/fugue/product-route";
import { readGitHubAppInstallationStatusForRepo } from "@/lib/github/app-installations";
import { normalizeGitHubRepositoryInput } from "@/lib/github/project-image-tracking";

export async function GET(request: Request) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  const url = new URL(request.url);
  const repoInput =
    url.searchParams.get("githubRepo") ?? url.searchParams.get("repo") ?? "";

  if (!repoInput.trim()) {
    return jsonError(400, "githubRepo is required.");
  }

  try {
    const githubRepo = normalizeGitHubRepositoryInput(repoInput);
    const installation = await readGitHubAppInstallationStatusForRepo({
      githubRepo,
      userEmail: session.email,
    });

    return NextResponse.json(
      {
        githubApp: installation.status,
      },
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
