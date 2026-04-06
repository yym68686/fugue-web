import { jsonError } from "@/lib/fugue/product-route";

export async function POST() {
  return jsonError(410, "Direct balance top-ups are disabled. Start a checkout instead.");
}
