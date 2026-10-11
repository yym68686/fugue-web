import { deploymentTargets } from "@/lib/fugue/runtime-management";
import { withServerActor } from "@/lib/servers/route";

export const dynamic = "force-dynamic";

// List the runtime targets this workspace can deploy to (managed-shared plus
// any runtimes the tenant owns). Used by the new-project wizard's runtime
// picker.
export async function GET() {
  return withServerActor((actor) =>
    deploymentTargets(actor.key, actor.tenantId),
  );
}
