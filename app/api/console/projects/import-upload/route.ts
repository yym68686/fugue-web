import { importUploadApp, listProjectSlugs } from "@/lib/fugue/console";
import { isObject, jsonError, readOptionalString, readStringMap } from "@/lib/fugue/product-route";
import { withWorkspaceKey } from "@/lib/console/route-helpers";
import { archiveNameCandidate, resolveUniqueProjectName } from "@/lib/deploy/project-name";

// Cap the upload we accept from the browser. The backend enforces its own
// (larger) archive limit; this is a first-line guard.
const MAX_UPLOAD_BYTES = 64 * 1024 * 1024;

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "Expected multipart/form-data.");
  }

  const rawPayload = form.get("payload");
  const file = form.get("file");
  if (typeof rawPayload !== "string") {
    return jsonError(400, "Missing payload.");
  }
  if (!(file instanceof Blob) || typeof (file as File).name !== "string") {
    return jsonError(400, "Missing source file.");
  }
  const upload = file as File;
  if (upload.size <= 0) return jsonError(400, "Source file is empty.");
  if (upload.size > MAX_UPLOAD_BYTES) {
    return jsonError(413, "Source file is too large.");
  }
  // The backend only accepts source archives (name + magic bytes must match).
  const lower = upload.name.trim().toLowerCase();
  if (!(lower.endsWith(".zip") || lower.endsWith(".tgz") || lower.endsWith(".tar.gz"))) {
    return jsonError(400, "Upload must be a .zip, .tgz, or .tar.gz archive.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    return jsonError(400, "Invalid payload JSON.");
  }
  if (!isObject(payload)) return jsonError(400, "Payload must be a JSON object.");

  // Project name is optional: derive from the uploaded archive's filename.
  const requestedProjectName = readOptionalString(payload, "projectName");

  const rawPort = payload.servicePort;
  let servicePort: number | undefined;
  if (rawPort !== undefined && rawPort !== null && rawPort !== "") {
    const n = typeof rawPort === "number" ? rawPort : Number(String(rawPort).trim());
    if (!Number.isInteger(n) || n <= 0) {
      return jsonError(400, "Service port must be a positive integer.");
    }
    servicePort = n;
  }

  return withWorkspaceKey(async (key) => {
    const existingSlugs = await listProjectSlugs(key);
    const projectName = resolveUniqueProjectName(
      requestedProjectName || archiveNameCandidate(upload.name),
      existingSlugs,
    );
    return importUploadApp(
      key,
      {
        projectName,
        projectDescription: readOptionalString(payload as Record<string, unknown>, "projectDescription") || undefined,
        appName: readOptionalString(payload as Record<string, unknown>, "appName") || undefined,
        runtimeId: readOptionalString(payload as Record<string, unknown>, "runtimeId") || undefined,
        servicePort,
        startupCommand: readOptionalString(payload as Record<string, unknown>, "startupCommand") || undefined,
        env: readStringMap((payload as Record<string, unknown>).env),
        buildStrategy: readOptionalString(payload as Record<string, unknown>, "buildStrategy") || undefined,
        dockerfilePath: readOptionalString(payload as Record<string, unknown>, "dockerfilePath") || undefined,
        buildContextDir: readOptionalString(payload as Record<string, unknown>, "buildContextDir") || undefined,
        sourceDir: readOptionalString(payload as Record<string, unknown>, "sourceDir") || undefined,
      },
      { name: upload.name, type: upload.type, data: upload },
    );
  });
}
