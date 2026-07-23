import {
  getBillingSummary,
  updateBillingCap,
  type BillingResourceSpec,
} from "@/lib/fugue/console";
import { isObject, jsonError, readJsonBody } from "@/lib/fugue/product-route";
import { withWorkspaceKey } from "@/lib/console/route-helpers";

/** Read a non-negative number from a request field, or null if invalid/absent. */
function readNonNegative(
  record: Record<string, unknown>,
  key: string,
): number | undefined | null {
  const raw = record[key];
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0) return null; // invalid
  return n;
}

export async function GET() {
  return withWorkspaceKey((key) => getBillingSummary(key, true));
}

export async function PATCH(request: Request) {
  const body = (await readJsonBody(request)) as Record<string, unknown> | null;
  if (!isObject(body)) return jsonError(400, "Request body must be a JSON object.");

  const cpuMillicores = readNonNegative(body, "cpuMillicores");
  const memoryMebibytes = readNonNegative(body, "memoryMebibytes");
  const storageGibibytes = readNonNegative(body, "storageGibibytes");

  if (cpuMillicores === null) return jsonError(400, "CPU must be a non-negative number.");
  if (memoryMebibytes === null) return jsonError(400, "Memory must be a non-negative number.");
  if (storageGibibytes === null) return jsonError(400, "Storage must be a non-negative number.");

  const cap: BillingResourceSpec = {
    cpu_millicores: Math.round(cpuMillicores ?? 0),
    memory_mebibytes: Math.round(memoryMebibytes ?? 0),
  };
  if (storageGibibytes !== undefined) {
    cap.storage_gibibytes = Math.round(storageGibibytes);
  }

  return withWorkspaceKey((key) => updateBillingCap(key, cap));
}
