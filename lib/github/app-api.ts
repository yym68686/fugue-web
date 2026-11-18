import "server-only";
import { sign } from "node:crypto";
import { requireGitHubAppConfiguration } from "./app-config";
import { runtimeIntegrationSecret } from "@/lib/admin/external-services";
import { githubId, githubObject, normalizeGitHubRepository } from "./app-events";
import { getGitHubConnectionByEmail } from "./connection-store";

export function createGitHubAppJWT(id: string, privateKey: string, now = Math.floor(Date.now() / 1000)) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iat: now - 60, exp: now + 540, iss: id })).toString("base64url");
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), privateKey).toString("base64url")}`;
}

async function githubGet(path: string, token: string) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "fugue-web" },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 404) throw new Error("404 GitHub repository or App installation was not found.");
  if (response.status === 401 || response.status === 403) throw new Error("403 GitHub permission verification failed. Check the connection and App permissions.");
  if (!response.ok) throw new Error("502 GitHub installation verification is temporarily unavailable.");
  return githubObject(await response.json());
}

export async function readRepositoryInstallation(repo: string, eventName?: string) {
  const config = requireGitHubAppConfiguration();
  const privateKey = await runtimeIntegrationSecret("GITHUB_APP_PRIVATE_KEY", config.privateKey);
  const installation = await githubGet(`/repos/${normalizeGitHubRepository(repo)}/installation`, createGitHubAppJWT(config.id, privateKey));
  const id = githubId(installation.id);
  if (!id || githubId(installation.app_id) !== config.id || installation.suspended_at) {
    throw new Error("409 GitHub App installation is missing or suspended.");
  }
  const permissions = githubObject(installation.permissions);
  if (eventName === "workflow_run" && !["read", "write"].includes(String(permissions.actions))) {
    throw new Error("409 GitHub App requires Actions read permission.");
  }
  if (eventName && (!Array.isArray(installation.events) || !installation.events.includes(eventName))) {
    throw new Error("409 GitHub App must subscribe to the selected release event.");
  }
  return { id, accountLogin: String(githubObject(installation.account).login ?? ""), repositorySelection: String(installation.repository_selection ?? "") };
}

export async function verifyRepositoryInstallation(email: string, repo: string, expectedId?: string, eventName?: string) {
  const normalized = normalizeGitHubRepository(repo);
  const connection = await getGitHubConnectionByEmail(email);
  if (!connection) throw new Error("409 Connect your GitHub account first.");
  const repository = await githubGet(`/repos/${normalized}`, connection.accessToken);
  const permissions = githubObject(repository.permissions);
  if (String(repository.full_name).toLowerCase() !== normalized || !(permissions.admin || permissions.maintain || permissions.push)) {
    throw new Error("403 Write access to the GitHub repository is required.");
  }
  const installation = await readRepositoryInstallation(normalized, eventName);
  if (expectedId && expectedId !== installation.id) throw new Error("409 GitHub installation does not match this repository.");
  return installation;
}
