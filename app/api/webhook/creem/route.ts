import { processCreemWebhookRequest } from "@/lib/billing/service";
import { jsonError, readErrorMessage, readErrorStatus } from "@/lib/fugue/product-route";

// Creem posts raw JSON signed with an HMAC over the exact bytes, so this route
// must read the unparsed body itself — keep it on the Node runtime and never
// let a framework body parser touch the request first.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    return await processCreemWebhookRequest(request);
  } catch (error) {
    const status = readErrorStatus(error);
    // Service errors embed their status inline (`401 ...`) so readErrorStatus can
    // recover it; strip that prefix from the human-facing message.
    const message = readErrorMessage(error).replace(/^\d{3}\s+/, "");
    return jsonError(status, message);
  }
}
