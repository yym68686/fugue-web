import { redirect } from "next/navigation";

import { AuthFinalizePanel } from "@/components/auth/auth-finalize-panel";
import { AuthShell } from "@/components/auth/auth-shell";
import { readAuthenticatedAppPath } from "@/lib/auth/handoff";
import { getRequestI18n } from "@/lib/i18n/server";
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
  const resolved = await Promise.resolve(searchParams);
  const returnTo = sanitizeReturnTo(readValue(resolved.returnTo));
  const authenticatedAppPath = await readAuthenticatedAppPath(returnTo);

  if (authenticatedAppPath) {
    redirect(authenticatedAppPath);
  }
  const { t } = await getRequestI18n();

  return (
    <AuthShell
      brandMeta={t("Finalize")}
      description={t("We are converting the provider callback into a first-party session before opening the destination route.")}
      eyebrow={t("Auth / Finalize")}
      footer={
        <p>{t("Privacy-focused browsers sometimes need one extra first-party handoff before the destination session is available.")}</p>
      }
      notes={[
        { index: "01", title: t("Provider callback"), meta: t("Google / Email / Verified identity") },
        { index: "02", title: t("Session handoff"), meta: t("First party / HttpOnly cookie") },
        { index: "03", title: t("Return route"), meta: t("Stable redirect / returnTo") },
      ]}
      title={t("Finalizing your access.")}
    >
      <AuthFinalizePanel returnTo={returnTo} />
    </AuthShell>
  );
}
