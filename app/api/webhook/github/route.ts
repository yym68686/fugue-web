import { processGitHubWebhookRequest } from "@/lib/github/app-webhook";
import { jsonError, readErrorMessage, readErrorStatus } from "@/lib/fugue/product-route";

export async function POST(request: Request) {
  try {
    return await processGitHubWebhookRequest(request);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
