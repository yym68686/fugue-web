import { AuthShell } from "@/components/auth/auth-shell";
import { EmailAuthForm } from "@/components/auth/email-auth-form";
import { ProviderButton } from "@/components/auth/provider-button";
import { Panel, PanelCopy, PanelDivider, PanelSection, PanelTitle } from "@/components/ui/panel";
import { ToastOnMount } from "@/components/ui/toast-on-mount";
import { getEmailVerificationRequired } from "@/lib/auth/env";

type SearchParams = Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;

function readValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readFlash(params: Record<string, string | string[] | undefined>) {
  const error = readValue(params.error);
  const state = readValue(params.state);

  if (error === "oauth_denied") {
    return { message: "Google sign-in was cancelled before authorization finished.", variant: "error" as const };
  }

  if (error === "oauth_failed") {
    return { message: "Google sign-in failed. Check the provider setup and try again.", variant: "error" as const };
  }

  if (error === "invalid-token") {
    return { message: "That email link is invalid or expired. Request a fresh one.", variant: "error" as const };
  }

  if (error === "auth-required") {
    return { message: "Sign in first to enter the control shell.", variant: "info" as const };
  }

  if (error === "account-blocked") {
    return { message: "This account is blocked. Contact an administrator.", variant: "error" as const };
  }

  if (error === "account-deleted") {
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
  const flash = readFlash(resolved);
  const emailVerificationRequired = getEmailVerificationRequired();

  return (
    <AuthShell
      description="Use Google or a verified email link. The route stays stable and the first auth layer stays light."
      eyebrow="Auth / Sign in"
      footer={
        <p>Passwordless email keeps the first auth layer light while the control shell grows around it.</p>
      }
      notes={[
        { index: "01", title: "Google provider", meta: "OAuth / Profile / Verified email" },
        { index: "02", title: "Verified email", meta: "Magic link / Resend / Callback" },
        { index: "03", title: "Session shell", meta: "HttpOnly cookie / 30 day window" },
      ]}
      title="Return without changing the route."
    >
      <Panel>
        <PanelSection>
          <p className="fg-label fg-panel__eyebrow">Sign in</p>
          <PanelTitle>Choose a provider and enter the control shell.</PanelTitle>
          <PanelCopy>
            Google is fastest. Email stays available when the account boundary should remain separate.
          </PanelCopy>
          <p className="fg-auth-footer">
            Need a fresh account boundary? <a href="/auth/sign-up">Create an account</a>.
          </p>
        </PanelSection>

        <PanelSection>
          <div className="fg-provider-stack">
            <ProviderButton href="/api/auth/google/start?mode=signin&returnTo=/app" provider="google" />
          </div>
        </PanelSection>

        <PanelSection>
          <PanelDivider>Or continue with email</PanelDivider>
        </PanelSection>

        <PanelSection>
          <ToastOnMount message={flash?.message ?? null} variant={flash?.variant ?? "info"} />
          <EmailAuthForm emailVerificationRequired={emailVerificationRequired} mode="signin" />
        </PanelSection>
      </Panel>
    </AuthShell>
  );
}
