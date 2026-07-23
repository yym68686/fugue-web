import type { Metadata } from "next";

import { AuthPanel } from "@/components/auth/auth-panel";
import { AuthShell } from "@/components/auth/auth-shell";
import { readAuthErrorMessage } from "@/lib/auth/error-messages";
import { sanitizeReturnTo } from "@/lib/auth/validation";
import { getRequestI18n } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Sign in — Fugue",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawReturnTo = Array.isArray(params.returnTo)
    ? params.returnTo[0]
    : params.returnTo;
  const returnTo = sanitizeReturnTo(rawReturnTo);
  const { t } = await getRequestI18n();
  const errorKey = readAuthErrorMessage(params.error);

  return (
    <AuthShell>
      <AuthPanel
        mode="sign-in"
        returnTo={returnTo}
        initialError={errorKey ? t(errorKey) : undefined}
      />
    </AuthShell>
  );
}
