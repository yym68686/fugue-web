import AppLayout from "@/components/AppLayout";
import ProfileSecurity from "@/components/profile/ProfileSecurity";
import { getRequestI18n } from "@/lib/i18n/server";
import { requireActivePageSession } from "@/lib/auth/page-access";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [{ user }, { t }] = await Promise.all([
    requireActivePageSession(),
    getRequestI18n(),
  ]);

  return (
    <AppLayout>
      <div className="page">
        <div className="phead">
          <div>
            <div className="eyebrow">Profile</div>
            <h1>{t("Profile and security")}</h1>
            <div className="meta">
              <span>{user.email}</span>
            </div>
          </div>
        </div>

        <ProfileSecurity
          initialName={user.name ?? ""}
          email={user.email}
          pictureUrl={user.pictureUrl}
        />
      </div>
    </AppLayout>
  );
}
