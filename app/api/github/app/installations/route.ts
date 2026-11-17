import { jsonError, readErrorMessage, readErrorStatus, requireActiveSessionUser } from "@/lib/fugue/product-route";
import { githubAppConfiguration } from "@/lib/github/app-config";
import { normalizeGitHubRepository } from "@/lib/github/app-events";
import { verifyRepositoryInstallation } from "@/lib/github/app-api";
import { recordVerifiedGitHubInstallation } from "@/lib/github/app-store";

export async function GET(request: Request) {
  const auth = await requireActiveSessionUser();
  if (auth.response) return auth.response;
  if (!githubAppConfiguration().configured) return Response.json({ configured: false, installed: false });
  try {
    const repo = normalizeGitHubRepository(new URL(request.url).searchParams.get("githubRepo") ?? "");
    const installation = await verifyRepositoryInstallation(auth.session.email, repo);
    await recordVerifiedGitHubInstallation(auth.session.email, repo, installation);
    return Response.json({ configured: true, installed: true, verified: true, githubRepo: repo, githubInstallationId: installation.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(readErrorStatus(error), readErrorMessage(error)); }
}
