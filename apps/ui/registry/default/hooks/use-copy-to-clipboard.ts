"use client";

import * as React from "react";

export function useCopyToClipboard({
  timeout = 2000,
  onCopy,
}: {
  timeout?: number;
  onCopy?: () => void;
} = {}): {
  copyToClipboard: (value: string) => Promise<boolean>;
  isCopied: boolean;
} {
  const [isCopied, setIsCopied] = React.useState(false);
  const timeoutIdRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyToClipboard = async (value: string): Promise<boolean> => {
    if (
      !value ||
      typeof window === "undefined" ||
      typeof navigator.clipboard?.writeText !== "function"
    ) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(value);
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      setIsCopied(true);

      if (onCopy) {
        onCopy();
      }

      if (timeout !== 0) {
        timeoutIdRef.current = setTimeout(() => {
          setIsCopied(false);
          timeoutIdRef.current = null;
        }, timeout);
      }
      return true;
    } catch {
      return false;
    }
  };

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return (): void => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  return { copyToClipboard, isCopied };
}
