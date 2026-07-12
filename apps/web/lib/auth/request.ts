export class AuthRequestTooLargeError extends Error {
  constructor() {
    super("Authentication request payload is too large.");
    this.name = "AuthRequestTooLargeError";
  }
}

export class AuthRequestMediaTypeError extends Error {
  constructor() {
    super("Unsupported authentication request content type.");
    this.name = "AuthRequestMediaTypeError";
  }
}

function readContentLength(request: Request) {
  const raw = request.headers.get("content-length");

  if (!raw) {
    return null;
  }

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export async function readLimitedRequestText(request: Request, maxBytes: number) {
  const contentLength = readContentLength(request);

  if (contentLength !== null && contentLength > maxBytes) {
    throw new AuthRequestTooLargeError();
  }

  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new AuthRequestTooLargeError();
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const payload = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    payload.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8", { fatal: true }).decode(payload);
}

export async function readLimitedJson<T>(request: Request, maxBytes: number) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (!contentType.includes("application/json")) {
    throw new AuthRequestMediaTypeError();
  }

  const text = await readLimitedRequestText(request, maxBytes);
  return JSON.parse(text) as T;
}

export async function readLimitedUrlEncodedForm(request: Request, maxBytes: number) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (!contentType.includes("application/x-www-form-urlencoded")) {
    throw new AuthRequestMediaTypeError();
  }

  return new URLSearchParams(await readLimitedRequestText(request, maxBytes));
}
