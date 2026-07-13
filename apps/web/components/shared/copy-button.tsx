"use client";

import { Button } from "@fugue/ui/components/button";
import { useCopyToClipboard } from "@fugue/ui/hooks/use-copy-to-clipboard";
import { Copy } from "lucide-react";
import { useState } from "react";
import { useClientUiMessages } from "@/components/i18n/locale-select";

export function CopyButton({
  failureMessage,
  value,
  label,
  successMessage,
}: {
  failureMessage?: string;
  value: string;
  label?: string;
  successMessage?: string;
}) {
  const messages = useClientUiMessages();
  const resolvedFailureMessage = failureMessage ?? messages.copyFailed;
  const resolvedLabel = label ?? messages.copy;
  const resolvedSuccessMessage = successMessage ?? messages.copySucceeded;
  const [status, setStatus] = useState<string | null>(null);
  const { copyToClipboard } = useCopyToClipboard({ timeout: 1_800 });

  async function copy() {
    const copied = await copyToClipboard(value);
    setStatus(copied ? resolvedSuccessMessage : resolvedFailureMessage);
    window.setTimeout(() => setStatus(null), 1_800);
  }

  return (
    <>
      <output aria-live="polite" className="sr-only">
        {status}
      </output>
      <Button onClick={copy} size="sm" type="button" variant="outline">
        <Copy aria-hidden="true" data-icon="inline-start" />
        {resolvedLabel}
      </Button>
    </>
  );
}
