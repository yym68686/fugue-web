"use client";

import { useRef, useState } from "react";

import { useT } from "@/lib/i18n/client";
import { copyText } from "@/lib/ui/clipboard";

export default function SecretCopyField({ secret }: { secret: string }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "copying" | "copied" | "failed">("idle");

  async function copy() {
    if (state === "copying") return;
    setState("copying");
    const copied = await copyText(secret);
    setState(copied ? "copied" : "failed");
    if (!copied) {
      input.current?.focus();
      input.current?.select();
    }
  }

  return (
    <>
      <div className="newkey-secret">
        <input
          ref={input}
          className="input mono"
          aria-label={t("API key secret")}
          readOnly
          value={secret}
          autoComplete="off"
          spellCheck={false}
          onFocus={(event) => event.currentTarget.select()}
          onClick={(event) => event.currentTarget.select()}
        />
        <button type="button" className="btn ghost" disabled={state === "copying"} onClick={copy} aria-live="polite">
          {state === "copied" ? t("Copied") : t("Copy")}
        </button>
      </div>
      {state === "failed" && (
        <p className="wb-alert err" role="alert">
          {t("Automatic copy failed. Select the key and copy it manually.")}
        </p>
      )}
    </>
  );
}
