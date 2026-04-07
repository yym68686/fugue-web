import { NextResponse } from "next/server";

import { ensureAppUserRecord, getAppUserByEmail } from "@/lib/app-users/store";
import {
  AUTH_ERROR_ACCOUNT_BLOCKED,
  AUTH_ERROR_ACCOUNT_DELETED,
  AUTH_ERROR_OAUTH_DENIED,
  AUTH_ERROR_OAUTH_FAILED,
  AUTH_ERROR_SESSION_OPEN_FAILED,
  type AuthErrorCode,
  buildSignInErrorUrl,
} from "@/lib/auth/errors";
import { buildSessionHandoffUrl } from "@/lib/auth/finalize";
import {
  exchangeGitHubCode,
  fetchGitHubUser,
} from "@/lib/auth/github";
import {
  findUserEmailByAuthMethod,
  syncAuthMethodOnSignIn,
} from "@/lib/auth/methods";
import { normalizeAuthOrigin, readRequestOrigin } from "@/lib/auth/origin";
import { verifyToken } from "@/lib/auth/token";
import { normalizeEmail } from "@/lib/auth/validation";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";

type StatePayload = {
  exp: number;
  iat: number;
  mode: "signin" | "signup";
  origin?: string;
  returnTo: string;
  type: "github-oauth-state";
};

function redirectWithError(origin: string, error: AuthErrorCode) {
  return NextResponse.redirect(buildSignInErrorUrl(origin, error, "github"), {
    status: 303,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestOrigin = readRequestOrigin(request);
  const error = url.searchParams.get("error");
  const stateToken = url.searchParams.get("state");
  const state = stateToken ? verifyToken<StatePayload>(stateToken) : null;
  const stateOrigin = normalizeAuthOrigin(state?.origin) ?? requestOrigin;

  if (error) {
    return redirectWithError(stateOrigin, AUTH_ERROR_OAUTH_DENIED);
  }

  const code = url.searchParams.get("code");

  if (!code || !stateToken) {
    return redirectWithError(requestOrigin, AUTH_ERROR_OAUTH_FAILED);
  }

  if (!state || state.type !== "github-oauth-state") {
    return redirectWithError(requestOrigin, AUTH_ERROR_OAUTH_FAILED);
  }

  try {
    const token = await exchangeGitHubCode(code);
    const user = await fetchGitHubUser(token.accessToken);
    const linkedEmail = await findUserEmailByAuthMethod("github", user.id);
    const resolvedEmail = linkedEmail ?? normalizeEmail(user.email);
    const existingUser = await getAppUserByEmail(resolvedEmail);
    const sessionUser = {
      email: resolvedEmail,
      name: user.name ?? existingUser?.name ?? undefined,
      picture: user.avatarUrl ?? existingUser?.pictureUrl ?? undefined,
      provider: "github" as const,
      providerId: user.id,
      verified: true,
      authMethod: "github" as const,
    };

    try {
      await ensureAppUserRecord(sessionUser, {
        markSignedIn: true,
      });
      await syncAuthMethodOnSignIn({
        email: resolvedEmail,
        method: "github",
        providerId: user.id,
        providerLabel: `@${user.login}`,
      });
      await ensureWorkspaceAccess(sessionUser);
    } catch (error) {
      if (error instanceof Error && error.message.includes("blocked")) {
        return redirectWithError(stateOrigin, AUTH_ERROR_ACCOUNT_BLOCKED);
      }

      if (error instanceof Error && error.message.includes("deleted")) {
        return redirectWithError(stateOrigin, AUTH_ERROR_ACCOUNT_DELETED);
      }

      console.error("GitHub sign-in provisioning failed.", error);
      return redirectWithError(stateOrigin, AUTH_ERROR_SESSION_OPEN_FAILED);
    }

    return NextResponse.redirect(
      buildSessionHandoffUrl(stateOrigin, sessionUser, state.returnTo),
      { status: 303 },
    );
  } catch (error) {
    console.error("GitHub OAuth callback failed.", error);
    return redirectWithError(stateOrigin, AUTH_ERROR_OAUTH_FAILED);
  }
}
