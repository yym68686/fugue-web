type ClipboardSource = Promise<string> | string;

function canUseClipboardApis() {
  return (
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    typeof navigator !== "undefined"
  );
}

function fallbackCopyText(value: string) {
  if (!canUseClipboardApis() || !document.body) {
    return false;
  }

  const selection = window.getSelection();
  const originalRanges =
    selection === null
      ? []
      : Array.from({ length: selection.rangeCount }, (_, index) =>
          selection.getRangeAt(index).cloneRange(),
        );
  const activeElement =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const temp = document.createElement("textarea");

  temp.value = value;
  temp.setAttribute("aria-hidden", "true");
  temp.setAttribute("readonly", "true");
  temp.style.position = "fixed";
  temp.style.top = "0";
  temp.style.left = "-9999px";
  temp.style.opacity = "0";
  temp.style.pointerEvents = "none";
  temp.style.fontSize = "12pt";
  temp.style.contain = "strict";

  document.body.appendChild(temp);

  try {
    temp.focus();
    temp.select();
    temp.setSelectionRange(0, temp.value.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    temp.remove();

    if (selection) {
      selection.removeAllRanges();
      originalRanges.forEach((range) => selection.addRange(range));
    }

    activeElement?.focus();
  }
}

async function copyResolvedText(
  value: string,
  { preferAsyncClipboard }: { preferAsyncClipboard: boolean },
) {
  if (!canUseClipboardApis()) {
    return false;
  }

  if (preferAsyncClipboard && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to the DOM selection fallback below.
    }
  }

  return fallbackCopyText(value);
}

export async function copyText(source: ClipboardSource) {
  if (!canUseClipboardApis()) {
    return false;
  }

  if (typeof source === "string") {
    return copyResolvedText(source, { preferAsyncClipboard: true });
  }

  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          // Safari requires the clipboard write request to begin inside the user gesture.
          "text/plain": source.then(
            (value) => new Blob([value], { type: "text/plain" }),
          ),
        }),
      ]);
      return true;
    } catch {
      // Fall through and retry once the text is resolved.
    }
  }

  const value = await source;
  return copyResolvedText(value, { preferAsyncClipboard: false });
}
