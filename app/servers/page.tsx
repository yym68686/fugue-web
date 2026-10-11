import AppLayout from "@/components/AppLayout";
import ConnectNodeButton from "@/components/servers/ConnectNodeButton";
import ServersPanel from "@/components/servers/ServersPanel";
import { requireActivePageSession } from "@/lib/auth/page-access";
import { getRequestI18n } from "@/lib/i18n/server";
import { getCachedWorkspaceAccessByEmail } from "@/lib/server/session-state-cache";
import { withPageTiming } from "@/lib/server/with-page-timing";
import { serversSnapshot } from "@/lib/servers/snapshot";

export const dynamic = "force-dynamic";
export default withPageTiming("/servers", async function ServersPage() {
  const { session, user } = await requireActivePageSession();
  const { t } = await getRequestI18n();
  const workspace = await getCachedWorkspaceAccessByEmail(session.email);
  const snapshot = workspace
    ? await serversSnapshot(workspace, Boolean(user?.isAdmin))
    : null;
  return (
    <AppLayout>
      <div className="page">
        <div className="phead">
          <div>
            <div className="eyebrow">Servers</div>
            <h1>{t("Server nodes")}</h1>
          </div>
          {workspace && (
            <div className="actions">
              <ConnectNodeButton />
            </div>
          )}
        </div>
        {snapshot ? (
          <ServersPanel snapshot={snapshot} />
        ) : (
          <p className="wb-alert err">
            {t("Your workspace is not ready yet.")}
          </p>
        )}
      </div>
    </AppLayout>
  );
});
