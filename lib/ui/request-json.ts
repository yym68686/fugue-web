import { sanitizePublicErrorMessage } from "@/lib/security/public-error.mjs";

// Cap how much of an error response body we read before giving up, so a
// misbehaving upstream can't stream an unbounded payload into the client.
const MAX_ERROR_BODY_BYTES = 16 * 1024;

async function readBoundedResponseBody(response: Response): Promise<string> {
  const text = await response.text();
  return text.length > MAX_ERROR_BODY_BYTES ? text.slice(0, MAX_ERROR_BODY_BYTES) : text;
}

/**
 * Extract a sanitized, user-safe error message from a failed fetch Response.
 * Prefers the JSON `{ error }` field, falls back to the (bounded) body text,
 * and always passes through the public-error boundary.
 */
export async function readResponseError(response: Response): Promise<string> {
  const body = await readBoundedResponseBody(response).catch(() => "");
  const trimmed = body.trim();

  if (!trimmed) {
    return sanitizePublicErrorMessage(null, response.status);
  }

  try {
    const payload = JSON.parse(trimmed) as { error?: unknown };
    if (typeof payload?.error === "string" && payload.error.trim()) {
      return sanitizePublicErrorMessage(payload.error, response.status);
    }
  } catch {
    // Plain text still crosses the same bounded public-error boundary.
  }

  return sanitizePublicErrorMessage(trimmed, response.status);
}
