"use client";

import { useEffect, useState, type ReactNode } from "react";

import { cx } from "@/lib/ui/cx";

function DisclosureChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="12"
      viewBox="0 0 12 12"
      width="12"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.25 4.5 6 8.25 9.75 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.35"
      />
    </svg>
  );
}

export function ConsoleDisclosureSection({
  children,
  className,
  defaultOpen = false,
  description,
  summary,
}: {
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  description?: ReactNode;
  summary: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen) {
      setIsOpen(true);
    }
  }, [defaultOpen]);

  return (
    <details
      className={cx(
        "fg-console-disclosure",
        "fg-console-disclosure--section",
        className,
      )}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      open={isOpen}
    >
      <summary>
        <span className="fg-console-disclosure__summary-copy">
          <span className="fg-console-disclosure__summary-label">{summary}</span>
          {description ? (
            <span className="fg-console-disclosure__summary-description">{description}</span>
          ) : null}
        </span>
        <span aria-hidden="true" className="fg-console-disclosure__summary-icon">
          <DisclosureChevronIcon />
        </span>
      </summary>
      <div className="fg-console-disclosure__panel">{children}</div>
    </details>
  );
}
