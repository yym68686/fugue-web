"use client";

import { useRef, useState, type ReactNode } from "react";
import Icon from "@/components/ui/Icon";
import { copyText } from "@/lib/ui/clipboard";
import { useI18n } from "@/lib/i18n/client";

export default function CodeBlock({ label, children, chinese: isChinese }: {
  label?: string;
  children: ReactNode;
  chinese?: boolean;
}) {
  const { locale } = useI18n();
  const chinese = isChinese ?? locale === "zh-CN";
  const code = useRef<HTMLElement>(null);
  const [feedback, setFeedback] = useState("");
  async function copy() {
    const element = code.current;
    if (!element) return;
    if (await copyText(element.textContent ?? "")) {
      setFeedback(chinese ? "已复制" : "Copied");
    } else {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      setFeedback(chinese ? "已选中命令，请手动复制。" : "Command selected. Copy it manually.");
    }
  }
  return (
    <div className="doc-code-wrap">
      <div className="doc-code-controls">
        {label && <span>{label}</span>}
        <button type="button" className="btn ghost" onClick={copy}>
          <Icon name="Copy" /> {chinese ? "复制" : "Copy"}
        </button>
      </div>
      <pre className="doc-code" tabIndex={0} aria-label={label ?? (chinese ? "命令" : "Command")}>
        <code ref={code}>{children}</code>
      </pre>
      <span className={feedback ? "form-hint" : "sr-only"} role="status">{feedback}</span>
    </div>
  );
}
