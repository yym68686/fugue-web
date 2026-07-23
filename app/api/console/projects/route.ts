import { createProject } from "@/lib/fugue/console";
import {
  jsonError,
  readJsonBody,
  readOptionalString,
} from "@/lib/fugue/product-route";
import { withWorkspaceKey } from "@/lib/console/route-helpers";

export async function POST(request: Request) {
  const body = (await readJsonBody(request)) as Record<string, unknown> | null;
  const name = body ? readOptionalString(body, "name") : undefined;
  if (!name) return jsonError(400, "name cannot be empty.");
  const description = body ? readOptionalString(body, "description") : undefined;
  return withWorkspaceKey((key) =>
    createProject(key, { name, description: description ?? "" }),
  );
}
