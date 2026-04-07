import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { ProviderButton } from "@/components/auth/provider-button";
import { SignInMethodSwitcher } from "@/components/auth/sign-in-method-switcher";
import { Panel, PanelCopy, PanelDivider, PanelSection, PanelTitle } from "@/components/ui/panel";
import {
  AUTH_ERROR_ACCOUNT_BLOCKED,
  AUTH_ERROR_ACCOUNT_DELETED,
  AUTH_ERROR_AUTH_REQUIRED,
  AUTH_ERROR_HANDOFF_FAILED,
  AUTH_ERROR_INVALID_TOKEN,
  AUTH_ERROR_OAUTH_DENIED,
  AUTH_ERROR_OAUTH_FAILED,
  AUTH_ERROR_SESSION_OPEN_FAILED,
} from "@/lib/auth/errors";
import { isGitHubAuthConfigured } from "@/lib/auth/github";
import { readAuthenticatedAppPath } from "@/lib/auth/handoff";
import { buildReturnToHref, sanitizeReturnTo } from "@/lib/auth/validation";
import { ToastOnMount } from "@/components/ui/toast-on-mount";
import { getEmailVerificationRequired } from "@/lib/auth/env";

type SearchParams = Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;

function readValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readFlash(params: Record<string, string | string[] | undefined>) {
  const error = readValue(params.error);
  const state = readValue(params.state);
  const provider = readValue(params.provider);
  const providerLabel = provider === "github" ? "GitHub" : "Google";

  if (error === AUTH_ERROR_OAUTH_DENIED) {
    return {
      message: `${providerLabel} sign-in was cancelled before authorization finished.`,
      variant: "error" as const,
    };
  }

  if (error === AUTH_ERROR_OAUTH_FAILED) {
    return {
      message: `${providerLabel} sign-in could not be completed. Check the callback URL and provider credentials, then try again.`,
      variant: "error" as const,
    };
  }

  if (error === AUTH_ERROR_INVALID_TOKEN) {
    return {
      message: "That email link is invalid or expired. Request a fresh one.",
      method: "email_link" as const,
      variant: "error" as const,
    };
  }

  if (error === AUTH_ERROR_SESSION_OPEN_FAILED) {
    return {
      message: "Sign-in was verified, but Fugue could not open your workspace session. Try again in a minute.",
      variant: "error" as const,
    };
  }

  if (error === AUTH_ERROR_HANDOFF_FAILED) {
    return {
      message: "Sign-in was verified, but the browser session handoff expired before the cookie was written. Start again.",
      variant: "error" as const,
    };
  }

  if (error === AUTH_ERROR_AUTH_REQUIRED) {
    return { message: "Sign in first to open the console.", variant: "info" as const };
  }

  if (error === AUTH_ERROR_ACCOUNT_BLOCKED) {
    return { message: "This account is blocked. Contact an administrator.", variant: "error" as const };
  }

  if (error === AUTH_ERROR_ACCOUNT_DELETED) {
    return { message: "This account has been deleted and can no longer sign in.", variant: "error" as const };
  }

  if (state === "signed-out") {
    return { message: "You have been signed out.", variant: "info" as const };
  }

  return null;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolved = await Promise.resolve(searchParams);
  const returnTo = sanitizeReturnTo(readValue(resolved.returnTo));
  const authenticatedAppPath = await readAuthenticatedAppPath(returnTo);

  if (authenticatedAppPath) {
    redirect(authenticatedAppPath);
  }
  const flash = readFlash(resolved);
  const emailVerificationRequired = getEmailVerificationRequired();
  const githubAuthEnabled = isGitHubAuthConfigured();
  const initialMethod =
    readValue(resolved.method) === "email-link" || flash?.method === "email_link"
      ? "email_link"
      : "password";
  const providerCopy = githubAuthEnabled
    ? "Google or GitHub are fastest. Password works if you already added one."
    : "Google is fastest. Password works if you already added one.";

  return (
    <AuthShell
      description={
        githubAuthEnabled
          ? "Use Google, GitHub, a password, or a verified email link."
          : "Use Google, a password, or a verified email link."
      }
      eyebrow="Auth / Sign in"
      footer={
        <p>Password can be added later from Profile and security. Email link access stays available without a stored secret.</p>
      }
      notes={[
        { index: "01", title: "Google provider", meta: "OAuth / Profile / Verified email" },
        githubAuthEnabled
          ? { index: "02", title: "GitHub provider", meta: "OAuth / Verified email / Linked account" }
          : { index: "02", title: "Password lane", meta: "Stored secret / Current account email" },
        { index: "03", title: "Email route", meta: "Magic link / Resend / Callback" },
      ]}
      title="Sign in to the console."
    >
      <Panel>
        <PanelSection>
          <p className="fg-label fg-panel__eyebrow">Sign in</p>
          <PanelTitle>Choose a sign-in method.</PanelTitle>
          <PanelCopy>{providerCopy}</PanelCopy>
          <p className="fg-auth-footer">
            Need a fresh account boundary? <a href={buildReturnToHref("/auth/sign-up", returnTo)}>Create an account</a>.
          </p>
        </PanelSection>

        <PanelSection>
          <div className="fg-provider-stack">
            <ProviderButton
              href={`/api/auth/google/start?mode=signin&returnTo=${encodeURIComponent(returnTo)}`}
              provider="google"
            />
            {githubAuthEnabled ? (
              <ProviderButton
                href={`/api/auth/github/start?mode=signin&returnTo=${encodeURIComponent(returnTo)}`}
                provider="github"
              />
            ) : null}
          </div>
        </PanelSection>

        <PanelSection>
          <PanelDivider>Or use your account email</PanelDivider>
        </PanelSection>

        <PanelSection>
          <ToastOnMount message={flash?.message ?? null} variant={flash?.variant ?? "info"} />
          <SignInMethodSwitcher
            emailVerificationRequired={emailVerificationRequired}
            initialMethod={initialMethod}
            returnTo={returnTo}
          />
        </PanelSection>
      </Panel>
    </AuthShell>
  );
}
