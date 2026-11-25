"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Icon from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n/client";

export default function RowActions({ children, label, inline = false }: { children: ReactNode; label?: string; inline?: boolean }) {
  const { locale } = useI18n();
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (details.current?.open && event.target instanceof Node && !details.current.contains(event.target)) {
        details.current.open = false;
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  return (
    <details className={`row-actions intent-action${inline ? " row-actions-inline" : ""}`} ref={details} onKeyDown={(event) => {
      if (event.key === "Escape" && !event.defaultPrevented && !(event.target as Element).closest("dialog")) {
        event.stopPropagation();
        event.currentTarget.open = false;
        event.currentTarget.querySelector("summary")?.focus();
      }
    }}>
      <summary className="btn ghost" aria-label={label ?? (locale === "zh-CN" ? "更多操作" : "More actions")}><Icon name="More" /></summary>
      <div className="row-actions-content">{children}</div>
    </details>
  );
}
