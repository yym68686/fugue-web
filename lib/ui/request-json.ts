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

export function readRequestError(error: unknown) {
  if (isAbortRequestError(error)) {
    return "Request canceled.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Request failed.";
}

export async function readResponseError(response: Response) {
  const body = await response.text().catch(() => "");
  const trimmed = body.trim();

  if (!trimmed) {
    return `Request failed with status ${response.status}.`;
  }

  try {
    const payload = JSON.parse(trimmed) as { error?: unknown };

    if (typeof payload?.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    // Fall back to the raw response body when the endpoint returns plain text.
  }

  return trimmed;
}

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(await readResponseError(response));
  }

  return (await response.json().catch(() => ({}))) as T;
}
