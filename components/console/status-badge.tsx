import type { ReactNode } from "react";

import type { ConsoleTone } from "@/lib/console/types";
import { cx } from "@/lib/ui/cx";

export function StatusBadge({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: ConsoleTone;
}) {
  return <span className={cx("fg-status-badge", `fg-status-badge--${tone}`, className)}>{children}</span>;
}
