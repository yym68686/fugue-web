import { PageHeader } from "@/components/shared/page-header";
import { ProfileSecurity } from "@/components/console/islands/profile-security";
import { getRequestI18n } from "@/lib/i18n/server";
import { createProfileFormMessages } from "@/lib/i18n/ui-messages";

export default async function ProfileSettingsPage() {
  const { t } = await getRequestI18n();

  return (
    <>
      <PageHeader
        title={t("Profile and security")}
        description={t(
          "Display name, account email, active session, connected providers, email links, password, and at-least-one-method protection.",
        )}
      />
      <ProfileSecurity messages={createProfileFormMessages(t)} />
    </>
  );
}
