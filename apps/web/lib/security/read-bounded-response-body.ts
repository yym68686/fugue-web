export const PUBLIC_ERROR_BODY_MAX_BYTES = 64 * 1024;

export async function readBoundedResponseBody(
  response: Response,
  maxBytes = PUBLIC_ERROR_BODY_MAX_BYTES,
) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError("maxBytes must be a positive safe integer.");
  }

  const reader = response.body?.getReader();

  if (!reader) {
    return "";
  }

  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (byteLength < maxBytes) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (!value?.byteLength) {
        continue;
      }

      const remaining = maxBytes - byteLength;

      if (value.byteLength > remaining) {
        chunks.push(value.slice(0, remaining));
        byteLength += remaining;
        await reader
          .cancel("Public error response exceeded the read limit.")
          .catch(() => undefined);
        break;
      }

      chunks.push(value);
      byteLength += value.byteLength;

      if (byteLength === maxBytes) {
        await reader
          .cancel("Public error response reached the read limit.")
          .catch(() => undefined);
      }
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(body);
}
