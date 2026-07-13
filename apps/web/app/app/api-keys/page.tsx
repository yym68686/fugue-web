import { AccessKeysConsole } from "@/components/console/islands/access-keys-console";
import { PageHeader } from "@/components/shared/page-header";
import { requireActivePageSession } from "@/lib/auth/page-access";
import { createAccessKeysStateMessages } from "@/lib/i18n/console-messages";
import { getRequestI18n } from "@/lib/i18n/server";

export default async function ApiKeysPage() {
  await requireActivePageSession();
  const { locale, t } = await getRequestI18n();

  return (
    <>
      <PageHeader
        title={t("Access keys")}
        description={t(
          "Workspace API keys and node enrollment keys with scopes, one-time secrets, join commands, rotation, and revoke actions.",
        )}
      />
      <AccessKeysConsole
        locale={locale}
        stateMessages={createAccessKeysStateMessages(t)}
      />
    </>
  );
}
