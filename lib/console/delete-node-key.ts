import "server-only";

import { revokeNodeKey } from "@/lib/fugue/console";
import { deleteManagedNodeKey, revokeManagedNodeKey } from "@/lib/workspace/store";

/** Called only after resolveOwnedNodeKey authorizes the caller's mirror row. */
export async function deleteOwnedNodeKey(input: {
  email: string;
  nodeKeyId: string;
  adminKeySecret: string;
}) {
  // Re-run even for revoked mirrors: an earlier cleanup may have failed.
  // Do not hide the key on an uncertain backend response, including 404.
  const result = await revokeNodeKey(input.adminKeySecret, input.nodeKeyId);
  if (result.node_key?.id !== input.nodeKeyId || result.node_key.status !== "revoked") {
    throw Object.assign(new Error("Node key revocation could not be verified."), { status: 502 });
  }
  await revokeManagedNodeKey(input);
  if (!result.cleanup) {
    throw Object.assign(new Error("Node key cleanup could not be verified."), { status: 502 });
  }
  if (result.cleanup?.warnings?.length) {
    throw Object.assign(new Error("The key was revoked, but server cleanup is incomplete. Retry deletion."), { status: 409 });
  }
  // The backend retains its revoked credential/audit record; the console mirror
  // is deleted only after invalidation and successful cleanup.
  await deleteManagedNodeKey(input);
}
