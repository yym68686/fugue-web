import type { Metadata } from "next";

import { AuthPanel } from "@/components/auth/auth-panel";
import { AuthShell } from "@/components/fugue-coss/shells";
import { createAuthPanelMessages } from "@/lib/auth/ui-messages";
import { sanitizeReturnTo } from "@/lib/auth/validation";
import { getRequestI18n } from "@/lib/i18n/server";
import { createShellMessages } from "@/lib/i18n/ui-messages";

type AuthPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    returnTo?: string | string[];
  }>;
};

function readSignInError(
  value: string | string[] | undefined,
  t: (key: string) => string,
) {
  const code = Array.isArray(value) ? value[0] : value;

  if (code === "account-blocked") return t("This account is blocked.");
  if (code === "account-deleted") return t("This account has been deleted.");
  if (code === "session-expired") return t("Your session expired. Sign in again.");
  return undefined;
}

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestI18n();
  return { title: t("Sign in to Fugue") };
}

export default async function SignInPage({ searchParams }: AuthPageProps) {
  const [params, { t }] = await Promise.all([searchParams, getRequestI18n()]);
  const rawReturnTo = Array.isArray(params.returnTo)
    ? params.returnTo[0]
    : params.returnTo;
  const returnTo = sanitizeReturnTo(rawReturnTo);

  return (
    <AuthShell
      messages={createShellMessages(t)}
      title={t("Sign in to Fugue")}
      description={t(
        "Provider auth, password auth, and email link auth all preserve the requested return destination.",
      )}
    >
      <AuthPanel
        initialError={readSignInError(params.error, t)}
        messages={createAuthPanelMessages(t)}
        mode="sign-in"
        returnTo={returnTo}
      />
    </AuthShell>
  );
}
