import type { Metadata } from "next";

import { AuthPanel } from "@/components/auth/auth-panel";
import { AuthShell } from "@/components/fugue-coss/shells";
import { createAuthPanelMessages } from "@/lib/auth/ui-messages";
import { sanitizeReturnTo } from "@/lib/auth/validation";
import { getRequestI18n } from "@/lib/i18n/server";
import { createShellMessages } from "@/lib/i18n/ui-messages";

type AuthPageProps = {
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestI18n();
  return { title: t("Create your Fugue account") };
}

export default async function SignUpPage({ searchParams }: AuthPageProps) {
  const [params, { t }] = await Promise.all([searchParams, getRequestI18n()]);
  const rawReturnTo = Array.isArray(params.returnTo)
    ? params.returnTo[0]
    : params.returnTo;
  const returnTo = sanitizeReturnTo(rawReturnTo);

  return (
    <AuthShell
      messages={createShellMessages(t)}
      title={t("Create your Fugue account")}
      description={t(
        "Create the account first, then continue the saved project or template deployment intent.",
      )}
    >
      <AuthPanel
        messages={createAuthPanelMessages(t)}
        mode="sign-up"
        returnTo={returnTo}
      />
    </AuthShell>
  );
}
