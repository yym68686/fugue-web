import { useId, type ReactNode } from "react";

import { cx } from "@/lib/ui/cx";

type HintTooltipProps = {
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
  tooltipClassName?: string;
};

type HintInlineProps = {
  as?: "div" | "span";
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
  hint?: ReactNode;
};

function HintTooltipIcon() {
  return (
    <svg
      aria-hidden="true"
      className="fg-hint-tooltip__icon"
      fill="none"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="10" cy="10" r="7.35" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M10 5.8V10.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
      <circle cx="10" cy="13.6" fill="currentColor" r="0.95" />
    </svg>
  );
}

export function HintTooltip({
  ariaLabel = "More information",
  children,
  className,
  tooltipClassName,
}: HintTooltipProps) {
  const tooltipId = useId();

  return (
    <span className={cx("fg-hint-tooltip", className)}>
      <button
        aria-describedby={tooltipId}
        aria-label={ariaLabel}
        className="fg-hint-tooltip__trigger"
        type="button"
      >
        <HintTooltipIcon />
      </button>
      <span
        className={cx("fg-hint-tooltip__bubble", tooltipClassName)}
        id={tooltipId}
        role="tooltip"
      >
        {children}
      </span>
    </span>
  );
}

export function HintInline({
  as: Component = "div",
  ariaLabel,
  children,
  className,
  hint,
}: HintInlineProps) {
  return (
    <Component className={cx("fg-hint-inline", className)}>
      {children}
      {hint ? <HintTooltip ariaLabel={ariaLabel}>{hint}</HintTooltip> : null}
    </Component>
  );
}
