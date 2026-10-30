import "server-only";
import { FugueApiError } from "./console";

/** Cookie-authenticated mutations require an exact browser origin. */
export async function readMailMutation(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("origin") !== new URL(request.url).origin) throw new FugueApiError(403, "Invalid origin.");
  const reader = request.body?.getReader();
  if (!reader) throw new FugueApiError(400, "JSON body required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16 * 1024) { await reader.cancel(); throw new FugueApiError(413, "Request too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let body: unknown;
  try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new FugueApiError(400, "Invalid JSON."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new FugueApiError(400, "JSON object required.");
  return body as Record<string, unknown>;
}

export function mailNoStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "no-store");
  return response;
}
