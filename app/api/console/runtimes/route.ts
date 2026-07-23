import { listRuntimeTargets } from "@/lib/fugue/console";
import { withWorkspaceKey } from "@/lib/console/route-helpers";

export const dynamic = "force-dynamic";

// List the runtime targets this workspace can deploy to (managed-shared plus
// any runtimes the tenant owns). Used by the new-project wizard's runtime
// picker.
export async function GET() {
  return withWorkspaceKey((key) => listRuntimeTargets(key));
}
