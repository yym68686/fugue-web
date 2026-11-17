import { NextRequest, NextResponse } from "next/server";
import { requireActiveSessionUser, jsonError } from "@/lib/fugue/product-route";
import { readRequestOrigin, isSecureRequest } from "@/lib/auth/origin";
import { normalizeEmail, sanitizeReturnTo } from "@/lib/auth/validation";
import { readGitHubInstallationState, GITHUB_INSTALL_COOKIE } from "@/lib/github/app-install-state";
import { verifyRepositoryInstallation } from "@/lib/github/app-api";
import { githubId } from "@/lib/github/app-events";
import { consumeGitHubInstallState, recordVerifiedGitHubInstallation } from "@/lib/github/app-store";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";

export async function GET(request: NextRequest) {
  const limited = await enforceAuthRateLimit(request, "oauth-callback-github");
  if (limited) return limited;
  const auth = await requireActiveSessionUser();
  if (auth.response) return auth.response;
  const origin = readRequestOrigin(request);
  const state = readGitHubInstallationState(request.nextUrl.searchParams.get("state") ?? "", request.cookies.get(GITHUB_INSTALL_COOKIE)?.value ?? "");
  if (!state || state.origin !== origin || state.email !== normalizeEmail(auth.session.email)) return jsonError(400, "Invalid or expired GitHub App installation state.");
  const target = new URL(sanitizeReturnTo(state.returnTo, origin), origin);
  let outcome = "failed";
  try {
    if (!await consumeGitHubInstallState(state.id)) return jsonError(409, "GitHub App installation callback was already used.");
    const id = githubId(request.nextUrl.searchParams.get("installation_id"));
    if (id && request.nextUrl.searchParams.get("setup_action") !== "request") {
      const installation = await verifyRepositoryInstallation(auth.session.email, state.repo, id);
      await recordVerifiedGitHubInstallation(auth.session.email, state.repo, installation);
      outcome = "installed";
    }
  } catch {
    console.error(JSON.stringify({ event: "github_app_install", category: "verification_failed" }));
  }
  target.searchParams.set("githubApp", outcome);
  const response = NextResponse.redirect(target, { status: 303 });
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(GITHUB_INSTALL_COOKIE, "", { httpOnly: true, secure: isSecureRequest(request), sameSite: "lax", path: "/api/github/app/install", maxAge: 0 });
  return response;
}
