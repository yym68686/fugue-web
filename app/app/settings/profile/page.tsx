import { PageHeader } from "@/components/coss/ui";
import { ProfileSecurity } from "@/components/fugue-coss/interactive";
import { ConsoleShell } from "@/components/fugue-coss/shells";

export default function ProfileSettingsPage() {
  return (
    <ConsoleShell>
      <PageHeader
        title="Profile and security"
        description="Display name, account email, active session, connected providers, email links, password, and at-least-one-method protection."
      />
      <ProfileSecurity />
    </ConsoleShell>
  );
}
