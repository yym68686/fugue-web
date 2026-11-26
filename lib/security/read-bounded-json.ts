/** Read a small JSON body without buffering an unbounded request stream. */
export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  let finished = false;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) {
        finished = true;
        return JSON.parse(text + decoder.decode());
      }
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) return null;
      text += decoder.decode(chunk.value, { stream: true });
    }
  } catch {
    return null;
  } finally {
    if (!finished) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
