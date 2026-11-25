import { withWorkspaceKey } from "@/lib/console/route-helpers";
import { getBillingSummary } from "@/lib/fugue/console";

export async function GET() {
  return withWorkspaceKey((key) => getBillingSummary(key, true));
}
