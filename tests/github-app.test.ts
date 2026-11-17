import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync, verify } from "node:crypto";
import { test } from "node:test";
import { createGitHubAppJWT } from "@/lib/github/app-api";
import { normalizeGitHubRepository, githubId, parseGitHubImageEvent, readGitHubWebhookBody, verifyGitHubSignature } from "@/lib/github/app-events";
import { createGitHubInstallationState, readGitHubInstallationState } from "@/lib/github/app-install-state";
import { readGitHubLinkInput } from "@/lib/github/app-service";
import { githubSyncDisposition } from "@/lib/github/app-worker";
import { signToken } from "@/lib/auth/token";

export function workflowPayload() {
  return { action: "completed", installation: { id: 42 }, repository: { full_name: "Owner/Repo" }, workflow_run: {
    status: "completed", conclusion: "success", event: "push", name: "Release", path: ".github/workflows/release.yml",
    head_branch: "main", head_repository: { full_name: "Owner/Repo" },
  } };
}

test("webhook signature covers raw bytes and rejects missing, malformed, and forged signatures", () => {
  const body = Buffer.from('{"hello":"world"}');
  const signature = `sha256=${createHmac("sha256", "synthetic-secret").update(body).digest("hex")}`;
  assert.equal(verifyGitHubSignature(body, signature, "synthetic-secret"), true);
  for (const bad of ["", "sha1=abc", "sha256=x", signature.toUpperCase(), `${signature}0`]) assert.equal(verifyGitHubSignature(body, bad, "synthetic-secret"), false);
  assert.equal(verifyGitHubSignature(Buffer.concat([body, Buffer.from(" ")]), signature, "synthetic-secret"), false);
  assert.equal(verifyGitHubSignature(body, signature, "other-secret"), false);
});

test("bounded webhook reader handles chunked bodies and rejects excessive actual or advertised bytes", async () => {
  assert.equal((await readGitHubWebhookBody(new Request("https://example.test", { method: "POST", body: "hello" }), 5)).toString(), "hello");
  await assert.rejects(readGitHubWebhookBody(new Request("https://example.test", { method: "POST", body: "hello", headers: { "content-length": "6" } }), 5), /413/);
  let cancelled = false;
  const body = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(4)); }, cancel() { cancelled = true; } });
  await assert.rejects(readGitHubWebhookBody(new Request("https://example.test", { method: "POST", body, duplex: "half" } as RequestInit), 5), /413/);
  assert.equal(cancelled, true);
});

test("only successful completed in-repository release workflows are eligible", () => {
  const parsed = parseGitHubImageEvent(workflowPayload(), "workflow_run", "delivery-1");
  assert.deepEqual(parsed, { repo: "owner/repo", installationId: "42", workflow: "Release", workflowPath: ".github/workflows/release.yml", branch: "main", packageName: "", deliveryId: "delivery-1", eventName: "workflow_run" });
  for (const patch of [ { event: "pull_request" }, { event: "pull_request_target" }, { conclusion: "failure" }, { status: "in_progress" }, { head_repository: { full_name: "attacker/repo" } }, { head_branch: "" } ]) {
    const value = workflowPayload(); Object.assign(value.workflow_run, patch);
    assert.equal(parseGitHubImageEvent(value, "workflow_run", "delivery-1"), null);
  }
  const started = workflowPayload(); started.action = "requested";
  assert.equal(parseGitHubImageEvent(started, "workflow_run", "delivery-1"), null);
});

test("only named container package publications are eligible", () => {
  const payload = { action: "published", repository: { full_name: "owner/repo" }, installation: { id: 42 }, registry_package: { name: "image", package_type: "container" } };
  assert.equal(parseGitHubImageEvent(payload, "registry_package", "d")?.packageName, "image");
  assert.equal(parseGitHubImageEvent({ ...payload, action: "deleted" }, "registry_package", "d"), null);
  assert.equal(parseGitHubImageEvent({ ...payload, registry_package: { name: "image", package_type: "npm" } }, "registry_package", "d"), null);
});

test("repository and event filters cannot use traversal, malformed IDs, or ambiguous package/workflow modes", () => {
  assert.equal(normalizeGitHubRepository(" Owner/Repo "), "owner/repo");
  for (const invalid of ["owner/..", "owner/.", "owner/repo/extra", "https://github.com/owner/repo", "owner/repo?x", "owner/%2e%2e"]) assert.throws(() => normalizeGitHubRepository(invalid));
  for (const invalid of [0, -1, Number.MAX_SAFE_INTEGER + 1, "01", "-1", null]) assert.equal(githubId(invalid), "");
  assert.equal(readGitHubLinkInput({ githubRepo: "owner/repo" }).branch, "main");
  assert.equal(readGitHubLinkInput({ githubRepo: "owner/repo", githubBranch: "", githubPackage: "image" }).packageName, "image");
  assert.throws(() => readGitHubLinkInput({ githubRepo: "owner/repo", githubPackage: "image" }));
  assert.throws(() => readGitHubLinkInput({ githubRepo: "owner/repo", githubBranch: "" }));
  assert.throws(() => readGitHubLinkInput({ githubRepo: "owner/repo", githubWorkflow: "a\nb" }));
});

test("GitHub App JWT uses RS256, App ID, a backdated issue time, and a sub-10-minute expiry", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const token = createGitHubAppJWT("123", privateKey.export({ type: "pkcs8", format: "pem" }).toString(), 1000);
  const [header, payload, signature] = token.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(header, "base64url").toString()), { alg: "RS256", typ: "JWT" });
  assert.deepEqual(JSON.parse(Buffer.from(payload, "base64url").toString()), { iat: 940, exp: 1540, iss: "123" });
  assert.equal(verify("RSA-SHA256", Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, "base64url")), true);
});

test("installation state is signed, expires and binds nonce, user, repo, origin, and return path", () => {
  const input = { email: "owner@example.test", repo: "owner/repo", origin: "https://console.example.test", returnTo: "/projects/project/services/app?tab=settings" };
  const { state, nonce } = createGitHubInstallationState(input);
  const parsed = readGitHubInstallationState(state, nonce)!;
  for (const [key, value] of Object.entries(input)) assert.equal(parsed[key as keyof typeof parsed], value);
  assert.equal(parsed.exp - parsed.iat, 600);
  assert.equal(readGitHubInstallationState(state, "other-nonce"), null);
  assert.equal(readGitHubInstallationState(`${state}x`, nonce), null);
  assert.equal(readGitHubInstallationState(signToken({ ...input, type: "other" }, 600), nonce), null);
  assert.equal(readGitHubInstallationState(signToken({ ...input, type: "github-app-install" }, -1), nonce), null);
});

test("busy-operation 202 is not confused with an accepted image sync", () => {
  const base = { app_id: "app", changed: false, already_current: false };
  assert.equal(githubSyncDisposition(base), "pending");
  assert.equal(githubSyncDisposition({ ...base, changed: true }), "completed");
  assert.equal(githubSyncDisposition({ ...base, already_current: true }), "completed");
});
