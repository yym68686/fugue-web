import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { EmailAuthForm } from "@/components/auth/email-auth-form";
import { ProviderButton } from "@/components/auth/provider-button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Panel, PanelCopy, PanelDivider, PanelSection, PanelTitle } from "@/components/ui/panel";
import { getEmailVerificationRequired } from "@/lib/auth/env";
import { readAuthenticatedAppPath } from "@/lib/auth/handoff";

type SearchParams = Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;

function readValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const authenticatedAppPath = await readAuthenticatedAppPath();

  if (authenticatedAppPath) {
    redirect(authenticatedAppPath);
  }

  const resolved = await Promise.resolve(searchParams);
  const state = readValue(resolved.state);
  const emailVerificationRequired = getEmailVerificationRequired();

  return (
    <AuthShell
      description="Choose Google or a verified email link."
      eyebrow="Auth / Sign up"
      footer={
        <p>Workspace setup comes next.</p>
      }
      notes={[
        { index: "01", title: "Google route", meta: "OAuth / Verified email" },
        { index: "02", title: "Email route", meta: "Magic link / 15 min" },
        { index: "03", title: "Post-auth", meta: "Workspace / Project / App" },
      ]}
      title="Create an account."
    >
      <Panel>
        <PanelSection>
          <p className="fg-label fg-panel__eyebrow">Create account</p>
          <PanelTitle>Choose a sign-up method.</PanelTitle>
          <PanelCopy>Google is fastest. Email works with a magic link.</PanelCopy>
          <p className="fg-auth-footer">
            Already have access? <a href="/auth/sign-in">Sign in instead</a>.
          </p>
        </PanelSection>

        <PanelSection>
          <div className="fg-provider-stack">
            <ProviderButton href="/api/auth/google/start?mode=signup&returnTo=/app" provider="google" />
          </div>
        </PanelSection>

        <PanelSection>
          <PanelDivider>Or continue with email</PanelDivider>
        </PanelSection>

        <PanelSection>
          {state === "verified" ? (
            <>
              <InlineAlert variant="success">Email verified. You can continue to the console.</InlineAlert>
              <div style={{ height: "1rem" }} aria-hidden="true" />
            </>
          ) : null}
          <EmailAuthForm emailVerificationRequired={emailVerificationRequired} mode="signup" />
        </PanelSection>
      </Panel>
    </AuthShell>
  );
}
