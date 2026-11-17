import { createHash, randomBytes, randomUUID } from "node:crypto";
import { signToken, verifyToken } from "@/lib/auth/token";

export const GITHUB_INSTALL_COOKIE = "fg_github_app_install_state";
type InstallationState = {
  type: "github-app-install"; id: string; email: string; repo: string; origin: string;
  returnTo: string; nonceHash: string; iat: number; exp: number;
};

export function createGitHubInstallationState(input: { email: string; repo: string; origin: string; returnTo: string }) {
  const nonce = randomBytes(32).toString("base64url");
  const state = signToken({ ...input, type: "github-app-install", id: randomUUID(), nonceHash: createHash("sha256").update(nonce).digest("hex") }, 600);
  return { nonce, state };
}

export function readGitHubInstallationState(token: string, nonce: string) {
  const state = verifyToken<InstallationState>(token);
  if (!state || state.type !== "github-app-install" || !nonce || typeof state.nonceHash !== "string" ||
      state.nonceHash !== createHash("sha256").update(nonce).digest("hex") ||
      ![state.id, state.email, state.repo, state.origin, state.returnTo].every((value) => typeof value === "string" && value.length > 0)) return null;
  return state;
}
