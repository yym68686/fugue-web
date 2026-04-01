import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { BillingPanel } from "@/components/console/billing-panel";
import { ConsolePageIntro } from "@/components/console/console-page-intro";
import { Panel, PanelSection } from "@/components/ui/panel";
import { getCurrentSession } from "@/lib/auth/session";
import { getBillingPageData } from "@/lib/billing/service";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";

export default async function BillingPage() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  try {
    await ensureWorkspaceAccess(session);
  } catch {
    // Fall through to stored workspace state or the recovery CTA.
  }

  const data = await getBillingPageData(session.email);

  return (
    <div className="fg-console-page">
      <ConsolePageIntro
        description="Set a tenant-wide managed capacity envelope, show the monthly estimate, and top up prepaid balance. Fugue meters managed capacity hourly and excludes external-owned BYO VPS."
        eyebrow="Billing"
        title="Managed capacity billing"
      />

      {data ? (
        <BillingPanel
          initialBilling={data.billing}
          initialSyncError={data.syncError}
          workspaceName={data.workspace.tenantName}
        />
      ) : (
        <Panel>
          <PanelSection>
            <ConsoleEmptyState
              action={{
                href: "/app/api-keys",
                label: "Open access setup",
                variant: "primary",
              }}
              description="Create the workspace admin access first so Fugue can read and update tenant billing."
              title="Billing needs a workspace"
            />
          </PanelSection>
        </Panel>
      )}
    </div>
  );
}
