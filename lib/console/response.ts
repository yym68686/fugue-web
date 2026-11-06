import { readBoundedResponseBody } from "@/lib/security/read-bounded-response-body";
import { sanitizePublicErrorMessage } from "@/lib/security/public-error.mjs";

export class ConsoleResponseError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ConsoleResponseError";
  }
}

function unexpectedResponse(response: Response) {
  const message = response.redirected || response.status === 401
    ? "Your session has expired. Sign in again."
    : response.status >= 500
      ? "The service is temporarily unavailable. Try again."
      : !response.ok
        ? "Request was rejected. Refresh and try again."
        : "The service returned an invalid response. Refresh and try again.";
  return new ConsoleResponseError(response.status, message);
}

/** Never expose proxy HTML, parse errors or key material as a console error. */
export async function readConsoleResult<T>(response: Response): Promise<T> {
  if (response.redirected) {
    await response.body?.cancel();
    throw unexpectedResponse(response);
  }
  const text = response.ok ? await response.text() : await readBoundedResponseBody(response);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw unexpectedResponse(response);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw unexpectedResponse(response);
  const body = data as { ok?: unknown; error?: unknown; result?: T };
  if (!response.ok || body.ok === false) {
    if (typeof body.error !== "string" || !body.error.trim()) throw unexpectedResponse(response);
    throw new ConsoleResponseError(response.status,
      sanitizePublicErrorMessage(body.error, response.ok ? 400 : response.status));
  }
  if (body.ok !== true || !Object.hasOwn(body, "result")) throw unexpectedResponse(response);
  return body.result as T;
}
