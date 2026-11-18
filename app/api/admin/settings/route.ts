import { NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/admin/route";
import { parseIntegrationSettings } from "@/lib/admin/integration-keys";
import { saveIntegrationCredential } from "@/lib/admin/external-services";
import { isSettingsWriteRequest, parseObjectStorageSettings } from "@/lib/admin/settings-input";
import { readRequestOrigin } from "@/lib/auth/origin";
import { withDbClient } from "@/lib/db/pool";
import { configureObjectStorage } from "@/lib/fugue/console";
import { jsonError, readErrorStatus } from "@/lib/fugue/product-route";
import { writeSecurityAuditEvent } from "@/lib/security/audit";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Cookie");
  return response;
}

async function parseBoundedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  let bytes = 0;
  let raw = "";
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.length;
      if (bytes > 16_384) return null;
      raw += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(raw + decoder.decode());
  } catch {
    return null;
  } finally {
    void reader.cancel().catch(() => {});
  }
}

export async function PUT(request: Request) {
  try {
    const access = await requireAdminRoute();
    if (access.response) return noStore(access.response);
    if (!isSettingsWriteRequest(request, readRequestOrigin(request))) {
      return noStore(jsonError(403, "A same-origin JSON request is required."));
    }
    const payload = await parseBoundedJson(request);
    const integration = parseIntegrationSettings(payload);
    if (integration) {
      try {
        await saveIntegrationCredential(integration.integration, integration.secret, access.user!.email);
      } catch (error) {
        return noStore(jsonError(readErrorStatus(error), "Could not update the integration credential."));
      }
      return noStore(NextResponse.json({ overridden: integration.secret !== null }));
    }
    const input = parseObjectStorageSettings(payload);
    if (!input) return noStore(jsonError(400, "Invalid storage provider settings."));
    try {
      await withDbClient((client) => writeSecurityAuditEvent(client, {
        action: "admin.object-storage.configure.requested",
        actorEmail: access.user!.email,
        metadata: { provider: input.provider },
      }));
    } catch {
      return noStore(jsonError(503, "Admin access audit is unavailable."));
    }
    return noStore(NextResponse.json({ result: await configureObjectStorage(input) }));
  } catch (error) {
    // Never send back credential fields, raw upstream messages, or request bodies.
    return noStore(jsonError(readErrorStatus(error), "Could not verify and save the provider credentials."));
  }
}
