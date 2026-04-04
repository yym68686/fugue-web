"use client";

import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { BillingPanel } from "@/components/console/billing-panel";
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
