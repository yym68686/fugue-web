import { ConsoleBillingPageShell } from "@/components/console/console-billing-page-shell";
import { getCurrentSession } from "@/lib/auth/session";
import { getBillingPageData } from "@/lib/billing/service";
import type { ConsoleBillingPageSnapshot } from "@/lib/console/page-snapshot-types";

export default async function BillingPage() {
  let initialSnapshot: ConsoleBillingPageSnapshot | null = null;
  const session = await getCurrentSession();

  if (session) {
    const data = await getBillingPageData(session.email, {
      includeCurrentUsage: false,
    });
    initialSnapshot = data
      ? {
          data,
          state: "ready",
        }
      : {
          state: "workspace-missing",
        };
  }

  return <ConsoleBillingPageShell initialSnapshot={initialSnapshot} />;
}
