import type { Metadata } from "next";

import { AuthPanel } from "@/components/auth/auth-panel";
import { AuthShell } from "@/components/auth/auth-shell";
import { readAuthErrorMessage } from "@/lib/auth/error-messages";
import { sanitizeReturnTo } from "@/lib/auth/validation";

export const metadata: Metadata = {
  title: "注册 — Fugue",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawReturnTo = Array.isArray(params.returnTo)
    ? params.returnTo[0]
    : params.returnTo;
  const returnTo = sanitizeReturnTo(rawReturnTo);

  return (
    <AuthShell>
      <AuthPanel
        mode="sign-up"
        returnTo={returnTo}
        initialError={readAuthErrorMessage(params.error)}
      />
    </AuthShell>
  );
}
