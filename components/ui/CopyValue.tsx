"use client";

import { useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n/client";
import { copyText } from "@/lib/ui/clipboard";

export default function CopyValue({ value, label }: { value: string; label: string }) {
  const { t, locale } = useI18n();
  const code = useRef<HTMLElement>(null);
  const [feedback, setFeedback] = useState("");
  return <span className="copy-value">
    <code ref={code}>{value}</code>
    <button type="button" className="btn ghost" aria-label={`${t("Copy")}: ${label}`}
      onClick={async () => {
        if (await copyText(value)) { setFeedback(t("Copied")); return; }
        if (!code.current) return;
        const range = document.createRange();
        range.selectNodeContents(code.current);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        setFeedback(locale === "zh-CN" ? "已选中，请手动复制" : "Selected for manual copy");
      }}><Icon name="Copy" /></button>
    <span role="status" className="sr-only">{feedback}</span>
  </span>;
}
