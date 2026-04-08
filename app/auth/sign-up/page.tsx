import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { EmailAuthForm } from "@/components/auth/email-auth-form";
import { ProviderButton } from "@/components/auth/provider-button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Panel, PanelCopy, PanelDivider, PanelSection, PanelTitle } from "@/components/ui/panel";
import { getEmailVerificationRequired } from "@/lib/auth/env";
import { readAuthenticatedAppPath } from "@/lib/auth/handoff";
import { getRequestI18n } from "@/lib/i18n/server";
import { buildReturnToHref, sanitizeReturnTo } from "@/lib/auth/validation";

type SearchParams = Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;

function readValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignUpPage({
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
  const state = readValue(resolved.state);
  const emailVerificationRequired = getEmailVerificationRequired();
  const { t } = await getRequestI18n();

  return (
    <AuthShell
      brandMeta={t("Sign up")}
      description={t("Choose Google or a verified email link. Password can be added later from the profile page.")}
      eyebrow={t("Auth / Sign up")}
      footer={
        <p>{t("Registration stays on the verification flow. Workspace setup comes next.")}</p>
      }
      notes={[
        { index: "01", title: t("Google route"), meta: t("OAuth / Verified email") },
        { index: "02", title: t("Email route"), meta: t("Magic link / 15 min") },
        { index: "03", title: t("Post-auth"), meta: t("Workspace / Project / App") },
      ]}
      title={t("Create an account.")}
    >
      <Panel>
        <PanelSection>
          <p className="fg-label fg-panel__eyebrow">{t("Create account")}</p>
          <PanelTitle>{t("Choose a sign-up method.")}</PanelTitle>
          <PanelCopy>{t("Google is fastest. Email still uses a verification link. Password can be added after sign-up.")}</PanelCopy>
          <p className="fg-auth-footer">
            {t("Already have access?")}{" "}
            <a href={buildReturnToHref("/auth/sign-in", returnTo)}>{t("Sign in instead")}</a>.
          </p>
        </PanelSection>

        <PanelSection>
          <div className="fg-provider-stack">
            <ProviderButton
              href={`/api/auth/google/start?mode=signup&returnTo=${encodeURIComponent(returnTo)}`}
              provider="google"
            />
          </div>
        </PanelSection>

        <PanelSection>
          <PanelDivider>{t("Or continue with email")}</PanelDivider>
        </PanelSection>

        <PanelSection>
          {state === "verified" ? (
            <>
              <InlineAlert variant="success">{t("Email verified. You can continue to the console.")}</InlineAlert>
              <div style={{ height: "1rem" }} aria-hidden="true" />
            </>
          ) : null}
          <EmailAuthForm
            emailVerificationRequired={emailVerificationRequired}
            mode="signup"
            returnTo={returnTo}
          />
        </PanelSection>
      </Panel>
    </AuthShell>
  );
}
