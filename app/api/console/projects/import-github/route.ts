import { importGitHubApp, listProjectSlugs } from "@/lib/fugue/console";
import {
  isObject,
  jsonError,
  readJsonBody,
  readOptionalString,
  readStringMap,
} from "@/lib/fugue/product-route";
import { withWorkspaceKey } from "@/lib/console/route-helpers";
import { requireActiveSessionUser } from "@/lib/fugue/product-route";
import { resolveGitHubRepoAuthTokenForEmail } from "@/lib/github/connection-store";
import { normalizeGitHubRepoVisibility } from "@/lib/github/repository";
import { repoNameCandidate, resolveUniqueProjectName } from "@/lib/deploy/project-name";

function readServicePort(record: Record<string, unknown>): number | undefined | null {
  const raw = record.servicePort;
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isInteger(n) || n <= 0) return null; // invalid
  return n;
}

export async function POST(request: Request) {
  const body = (await readJsonBody(request)) as Record<string, unknown> | null;
  if (!isObject(body)) return jsonError(400, "Request body must be a JSON object.");

  const repoUrl = readOptionalString(body, "repoUrl");
  if (!repoUrl) return jsonError(400, "Repository link is required.");
  // Project name is optional: an explicit name wins, otherwise we derive one
  // from the repo and resolve collisions against the caller's own projects.
  const requestedProjectName = readOptionalString(body, "projectName");

  const servicePort = readServicePort(body);
  if (servicePort === null) return jsonError(400, "Service port must be a positive integer.");

  const visibility = normalizeGitHubRepoVisibility(readOptionalString(body, "repoVisibility"));
  const manualToken = readOptionalString(body, "repoAuthToken");

  // For private repos, resolve a token: prefer the manually supplied one, else
  // the caller's saved GitHub connection. The token never reaches the client.
  const auth = await requireActiveSessionUser();
  if (auth.response) return auth.response;
  let repoAuthToken = manualToken || undefined;
  if (visibility === "private" && !repoAuthToken) {
    const resolved = await resolveGitHubRepoAuthTokenForEmail(auth.session.email, {
      explicitToken: manualToken || null,
      repoVisibility: "private",
    });
    repoAuthToken = resolved.token || undefined;
  }

  return withWorkspaceKey(async (key) => {
    const existingSlugs = await listProjectSlugs(key);
    const projectName = resolveUniqueProjectName(
      requestedProjectName || repoNameCandidate(repoUrl),
      existingSlugs,
    );
    return importGitHubApp(key, {
      projectName,
      projectDescription: readOptionalString(body, "projectDescription") || undefined,
      appName: readOptionalString(body, "appName") || undefined,
      repoUrl,
      branch: readOptionalString(body, "branch") || undefined,
      repoVisibility: visibility || undefined,
      repoAuthToken,
      buildStrategy: readOptionalString(body, "buildStrategy") || undefined,
      dockerfilePath: readOptionalString(body, "dockerfilePath") || undefined,
      buildContextDir: readOptionalString(body, "buildContextDir") || undefined,
      sourceDir: readOptionalString(body, "sourceDir") || undefined,
      runtimeId: readOptionalString(body, "runtimeId") || undefined,
      servicePort: servicePort ?? undefined,
      startupCommand: readOptionalString(body, "startupCommand") || undefined,
      env: readStringMap(body.env),
    });
  });
}
