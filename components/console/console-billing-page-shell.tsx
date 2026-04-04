"use client";

import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { BillingPanel } from "@/components/console/billing-panel";
import { ConsolePageIntro } from "@/components/console/console-page-intro";
import {
  ConsoleBillingPageSkeleton,
  ConsoleLoadingState,
} from "@/components/console/console-page-skeleton";
import { Panel, PanelSection } from "@/components/ui/panel";
import {
  CONSOLE_BILLING_PAGE_SNAPSHOT_URL,
  type ConsoleBillingPageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";

export function ConsoleBillingPageShell() {
  const { data, error, loading } =
    useConsolePageSnapshot<ConsoleBillingPageSnapshot>(
      CONSOLE_BILLING_PAGE_SNAPSHOT_URL,
    );

  if (loading && !data) {
    return (
      <ConsoleLoadingState>
        <ConsoleBillingPageSkeleton />
      </ConsoleLoadingState>
    );
  }

  if (!data) {
    return (
      <div className="fg-console-page">
        <ConsolePageIntro
          description="Set a tenant-wide managed capacity envelope, show the monthly estimate, and top up prepaid balance. Fugue meters managed capacity hourly and excludes external-owned BYO VPS."
          eyebrow="Billing"
          title="Managed capacity billing"
        />

        <Panel>
          <PanelSection>
            <ConsoleEmptyState
              description={error ?? "Fugue could not load the billing snapshot right now."}
              title="Billing snapshot unavailable"
            />
          </PanelSection>
        </Panel>
      </div>
    );
  }

  return (
    <div className="fg-console-page">
      <ConsolePageIntro
        description="Set a tenant-wide managed capacity envelope, show the monthly estimate, and top up prepaid balance. Fugue meters managed capacity hourly and excludes external-owned BYO VPS."
        eyebrow="Billing"
        title="Managed capacity billing"
      />

      {data.state === "ready" ? (
        <BillingPanel
          initialBilling={data.data.billing}
          initialSyncError={data.data.syncError}
          workspaceName={data.data.workspace.tenantName}
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
