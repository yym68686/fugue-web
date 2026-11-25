"use client";

import { useRef, useState } from "react";

import { useI18n } from "@/lib/i18n/client";
import { copyText } from "@/lib/ui/clipboard";

export default function SecretCopyField({ secret, label }: { secret: string; label?: string }) {
  const { t, locale } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  const [revealed, setRevealed] = useState(false);

  async function copy() {
    if (state === "copying") return;
    setState("copying");
    const copied = await copyText(secret);
    setState(copied ? "copied" : "failed");
    if (!copied && revealed) {
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
          aria-label={label ?? t("API key secret")}
          type={revealed ? "text" : "password"}
          readOnly
          value={revealed ? secret : "••••••••••••"}
          autoComplete="off"
          spellCheck={false}
          onFocus={(event) => { if (revealed) event.currentTarget.select(); }}
          onClick={(event) => { if (revealed) event.currentTarget.select(); }}
        />
        <button type="button" className="btn ghost" disabled={state === "copying"} onClick={copy} aria-live="polite">
          {state === "copied" ? t("Copied") : t("Copy")}
        </button>
        <button type="button" className="btn ghost" aria-pressed={revealed} onClick={() => setRevealed(!revealed)}>
          {locale === "zh-CN" ? (revealed ? "隐藏" : "显示") : (revealed ? "Hide" : "Show")}
        </button>
      </div>
      {state === "failed" && (
        <p className="wb-alert err" role="alert">
          {revealed ? (locale === "zh-CN" ? "无法自动复制。请选择内容并手动复制。" : "Automatic copy failed. Select the contents and copy manually.")
            : locale === "zh-CN" ? "复制失败。请明确选择显示，再手动复制。" : "Copy failed. Select Show to copy manually."}
        </p>
      )}
    </>
  );
}
