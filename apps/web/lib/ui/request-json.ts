import { sanitizePublicErrorMessage } from "@/lib/security/public-error.mjs";
import { readBoundedResponseBody } from "@/lib/security/read-bounded-response-body";

function isAbortMessage(message: string) {
  const normalized = message.trim().toLowerCase();

  return (
    normalized.includes("aborterror") ||
    normalized.includes("signal is aborted") ||
    normalized.includes("request was aborted") ||
    normalized.includes("request aborted") ||
    normalized.includes("aborted")
  );
}

export function createAbortRequestError(message = "Request was aborted.") {
  if (typeof DOMException === "function") {
    return new DOMException(message, "AbortError");
  }

  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

export function isAbortRequestError(error: unknown) {
  if (typeof DOMException === "function" && error instanceof DOMException) {
    return error.name === "AbortError";
  }

  if (error instanceof Error) {
    return error.name === "AbortError" || isAbortMessage(error.message);
  }

  return typeof error === "string" && isAbortMessage(error);
}

export class RequestError extends Error {
  readonly retryAfterSeconds: number | null;
  readonly status: number;

  constructor(message: string, status: number, retryAfterSeconds: number | null) {
    super(message);
    this.name = "RequestError";
    this.retryAfterSeconds = retryAfterSeconds;
    this.status = status;
  }
}

function readRetryAfterSeconds(response: Response) {
  const value = response.headers.get("Retry-After")?.trim();

  if (!value) {
    return null;
  }

  if (/^\d+$/.test(value)) {
    const seconds = Number(value);
    return Number.isSafeInteger(seconds) ? Math.max(1, seconds) : null;
  }

  const retryAt = Date.parse(value);

  if (!Number.isFinite(retryAt)) {
    return null;
  }

  return Math.max(1, Math.ceil((retryAt - Date.now()) / 1_000));
}

export function readRequestError(error: unknown) {
  if (isAbortRequestError(error)) {
    return "Request canceled.";
  }

  if (
    error instanceof RequestError &&
    error.status === 429 &&
    error.retryAfterSeconds
  ) {
    return `${error.message} Try again in ${error.retryAfterSeconds} seconds.`;
  }

  return sanitizePublicErrorMessage(error, readRequestErrorStatus(error) ?? undefined);
}

export function readRequestErrorStatus(error: unknown) {
  if (!(error instanceof Error)) {
    return null;
  }

  if (error instanceof RequestError) {
    return error.status;
  }

  const match = error.message.match(
    /\b(400|401|402|403|404|408|409|413|415|422|429|500|502|503|504)\b/,
  );

  return match ? Number(match[1]) : null;
}

export function isNetworkRequestError(error: unknown) {
  if (isAbortRequestError(error) || error instanceof RequestError) {
    return false;
  }

  if (typeof DOMException === "function" && error instanceof DOMException) {
    return error.name === "NetworkError";
  }

  if (!(error instanceof Error)) {
    return false;
  }

  if (error instanceof TypeError || error.name === "FetchError") {
    return true;
  }

  const cause = Reflect.get(error, "cause");
  const code = cause && typeof cause === "object" ? Reflect.get(cause, "code") : null;

  return (
    typeof code === "string" &&
    /^(?:ECONNABORTED|ECONNREFUSED|ECONNRESET|ENETUNREACH|ENOTFOUND|ETIMEDOUT)$/u.test(
      code,
    )
  );
}

export async function readResponseError(response: Response) {
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

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new RequestError(
      await readResponseError(response),
      response.status,
      readRetryAfterSeconds(response),
    );
  }

  return (await response.json().catch(() => ({}))) as T;
}
