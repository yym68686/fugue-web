import { FinalizePanel } from "@/components/auth/finalize-panel";
import { AuthShell } from "@/components/fugue-coss/shells";
import { createAuthFinalizeMessages } from "@/lib/auth/ui-messages";
import { getRequestI18n } from "@/lib/i18n/server";
import { createShellMessages } from "@/lib/i18n/ui-messages";

export default async function FinalizePage() {
  const { t } = await getRequestI18n();

  return (
    <AuthShell
      messages={createShellMessages(t)}
      title={t("Finalize session")}
      description={t(
        "Convert the OAuth or email-link handoff into a Fugue browser session.",
      )}
    >
      <FinalizePanel messages={createAuthFinalizeMessages(t)} />
    </AuthShell>
  );
}
