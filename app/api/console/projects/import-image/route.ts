import { importImageApp } from "@/lib/fugue/console";
import {
  isObject,
  jsonError,
  readJsonBody,
  readOptionalString,
  readStringMap,
} from "@/lib/fugue/product-route";
import { withWorkspaceKey } from "@/lib/console/route-helpers";

function readServicePort(record: Record<string, unknown>): number | undefined | null {
  const raw = record.servicePort;
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export async function POST(request: Request) {
  const body = (await readJsonBody(request)) as Record<string, unknown> | null;
  if (!isObject(body)) return jsonError(400, "Request body must be a JSON object.");

  const projectName = readOptionalString(body, "projectName");
  if (!projectName) return jsonError(400, "Project name is required.");
  const imageRef = readOptionalString(body, "imageRef");
  if (!imageRef) return jsonError(400, "Image reference is required.");

  const servicePort = readServicePort(body);
  if (servicePort === null) return jsonError(400, "Service port must be a positive integer.");

  return withWorkspaceKey((key) =>
    importImageApp(key, {
      projectName,
      projectDescription: readOptionalString(body, "projectDescription") || undefined,
      appName: readOptionalString(body, "appName") || undefined,
      imageRef,
      runtimeId: readOptionalString(body, "runtimeId") || undefined,
      servicePort: servicePort ?? undefined,
      startupCommand: readOptionalString(body, "startupCommand") || undefined,
      env: readStringMap(body.env),
    }),
  );
}
