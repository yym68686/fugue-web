import { processCreemWebhookRequest } from "@/lib/billing/service";
import { jsonError, readErrorMessage, readErrorStatus } from "@/lib/fugue/product-route";

export async function POST(request: Request) {
  try {
    return await processCreemWebhookRequest(request);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
