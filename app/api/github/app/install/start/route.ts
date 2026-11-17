import { NextResponse } from "next/server";
import { requireActiveSessionUser, jsonError, readErrorStatus, readErrorMessage } from "@/lib/fugue/product-route";
import { readRequestOrigin, isSecureRequest } from "@/lib/auth/origin";
import { sanitizeReturnTo, normalizeEmail } from "@/lib/auth/validation";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { requireGitHubAppConfiguration } from "@/lib/github/app-config";
import { normalizeGitHubRepository } from "@/lib/github/app-events";
import { getGitHubConnectionSnapshotByEmail } from "@/lib/github/connection-store";
import { createGitHubInstallationState, GITHUB_INSTALL_COOKIE } from "@/lib/github/app-install-state";

export async function GET(request: Request) {
  const limited = await enforceAuthRateLimit(request, "oauth-start-github");
  if (limited) return limited;
  const auth = await requireActiveSessionUser();
  if (auth.response) return auth.response;
  try {
    const config = requireGitHubAppConfiguration();
    const url = new URL(request.url);
    const origin = readRequestOrigin(request);
    const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"), origin);
    const repo = normalizeGitHubRepository(url.searchParams.get("githubRepo") ?? "");
    if (!await getGitHubConnectionSnapshotByEmail(auth.session.email)) return jsonError(409, "Connect your GitHub account first.");
    const { state, nonce } = createGitHubInstallationState({ email: normalizeEmail(auth.session.email), repo, origin, returnTo });
    const target = new URL(`https://github.com/apps/${config.slug}/installations/new`);
    target.searchParams.set("state", state);
    const response = NextResponse.redirect(target, { status: 303 });
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(GITHUB_INSTALL_COOKIE, nonce, { httpOnly: true, secure: isSecureRequest(request), sameSite: "lax", path: "/api/github/app/install", maxAge: 600 });
    return response;
  } catch (error) { return jsonError(readErrorStatus(error), readErrorMessage(error)); }
}
