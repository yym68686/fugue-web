export type ParsedSSEEvent = {
  data: string;
  event: string;
  id: string;
};

type ConsumeSSEStreamOptions = {
  onEvent: (event: ParsedSSEEvent) => void | Promise<void>;
  onRetry?: (milliseconds: number) => void;
};

export async function consumeSSEStream(
  response: Response,
  { onEvent, onRetry }: ConsumeSSEStreamOptions,
) {
  if (!response.body) {
    throw new Error("Streaming response body is unavailable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";
  let currentId = "";
  let currentData: string[] = [];

  async function dispatchEvent() {
    if (!currentEvent && !currentId && currentData.length === 0) {
      return;
    }

    await onEvent({
      data: currentData.join("\n"),
      event: currentEvent || "message",
      id: currentId,
    });

    currentEvent = "";
    currentId = "";
    currentData = [];
  }

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    while (true) {
      const newlineIndex = buffer.indexOf("\n");

      if (newlineIndex === -1) {
        break;
      }

      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) {
        line = line.slice(0, -1);
      }

      if (line === "") {
        await dispatchEvent();
        continue;
      }

      if (line.startsWith(":")) {
        continue;
      }

      const separatorIndex = line.indexOf(":");
      const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
      let fieldValue = separatorIndex === -1 ? "" : line.slice(separatorIndex + 1);

      if (fieldValue.startsWith(" ")) {
        fieldValue = fieldValue.slice(1);
      }

      switch (field) {
        case "data":
          currentData.push(fieldValue);
          break;
        case "event":
          currentEvent = fieldValue;
          break;
        case "id":
          currentId = fieldValue;
          break;
        case "retry": {
          const milliseconds = Number.parseInt(fieldValue, 10);

          if (Number.isFinite(milliseconds) && milliseconds >= 0) {
            onRetry?.(milliseconds);
          }
          break;
        }
        default:
          break;
      }
    }

    if (done) {
      buffer += decoder.decode();

      if (buffer.length > 0) {
        let trailingLine = buffer;

        if (trailingLine.endsWith("\r")) {
          trailingLine = trailingLine.slice(0, -1);
        }

        if (trailingLine.startsWith("data:")) {
          currentData.push(trailingLine.slice(5).trimStart());
        } else if (trailingLine.startsWith("event:")) {
          currentEvent = trailingLine.slice(6).trimStart();
        } else if (trailingLine.startsWith("id:")) {
          currentId = trailingLine.slice(3).trimStart();
        }
      }

      await dispatchEvent();
      return;
    }
  }
}
