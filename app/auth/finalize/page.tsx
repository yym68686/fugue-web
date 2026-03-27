import { redirect } from "next/navigation";

import { AuthFinalizePanel } from "@/components/auth/auth-finalize-panel";
import { AuthShell } from "@/components/auth/auth-shell";
import { readAuthenticatedAppPath } from "@/lib/auth/handoff";
import { sanitizeReturnTo } from "@/lib/auth/validation";

type SearchParams = Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;

function readValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AuthFinalizePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const authenticatedAppPath = await readAuthenticatedAppPath();

  if (authenticatedAppPath) {
    redirect(authenticatedAppPath);
  }

  const resolved = await Promise.resolve(searchParams);
  const returnTo = sanitizeReturnTo(readValue(resolved.returnTo));

  return (
    <AuthShell
      description="We are converting the provider callback into a first-party session before opening the console."
      eyebrow="Auth / Finalize"
      footer={
        <p>Privacy-focused browsers sometimes need one extra first-party handoff before the console session is available.</p>
      }
      notes={[
        { index: "01", title: "Provider callback", meta: "Google / Email / Verified identity" },
        { index: "02", title: "Session handoff", meta: "First party / HttpOnly cookie" },
        { index: "03", title: "Console route", meta: "Stable redirect / /app" },
      ]}
      title="Finalizing your access."
    >
      <AuthFinalizePanel returnTo={returnTo} />
    </AuthShell>
  );
}
