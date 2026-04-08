import type { ReactNode } from "react";

import type { ConsoleTone } from "@/lib/console/types";
import { cx } from "@/lib/ui/cx";

export function StatusBadge({
  children,
  className,
  live = false,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  live?: boolean;
  tone?: ConsoleTone;
}) {
  return (
    <span
      className={cx(
        "fg-status-badge",
        `fg-status-badge--${tone}`,
        live && "fg-status-badge--live",
        className,
      )}
    >
      {live ? <span aria-hidden="true" className="fg-status-badge__dot" /> : null}
      <span className="fg-status-badge__label">{children}</span>
    </span>
  );
}
