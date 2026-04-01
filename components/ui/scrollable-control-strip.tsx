"use client";

import type { ReactNode, WheelEvent } from "react";
import { useEffect, useRef } from "react";

import { cx } from "@/lib/ui/cx";

type ScrollableControlStripProps = {
  activeSelector: string;
  children: ReactNode;
  className?: string;
  variant: "pill" | "segmented";
  viewportClassName?: string;
  watchKey: string | number;
};

export function ScrollableControlStrip({
  activeSelector,
  children,
  className,
  variant,
  viewportClassName,
  watchKey,
}: ScrollableControlStripProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;

    if (!viewport || viewport.scrollWidth <= viewport.clientWidth) {
      return;
    }

    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      return;
    }

    const nextScrollLeft = viewport.scrollLeft + event.deltaY;
    const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;

    if ((event.deltaY < 0 && nextScrollLeft <= 0) || (event.deltaY > 0 && nextScrollLeft >= maxScrollLeft)) {
      return;
    }

    viewport.scrollBy({
      left: event.deltaY,
      behavior: "auto",
    });
    event.preventDefault();
  }

  useEffect(() => {
    const shell = shellRef.current;
    const viewport = viewportRef.current;

    if (!shell || !viewport) {
      return;
    }

    const shellElement = shell;
    const viewportElement = viewport;
    const content = viewportElement.firstElementChild;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function syncShellState() {
      const hasOverflow = viewportElement.scrollWidth - viewportElement.clientWidth > 1;
      const isAtStart = viewportElement.scrollLeft <= 2;
      const isAtEnd =
        viewportElement.scrollLeft + viewportElement.clientWidth >= viewportElement.scrollWidth - 2;

      shellElement.dataset.overflow = hasOverflow ? "true" : "false";
      shellElement.dataset.scrollStart = isAtStart ? "true" : "false";
      shellElement.dataset.scrollEnd = isAtEnd ? "true" : "false";
    }

    const activeElement = viewportElement.querySelector<HTMLElement>(activeSelector);

    if (activeElement) {
      const viewportBounds = viewportElement.getBoundingClientRect();
      const activeBounds = activeElement.getBoundingClientRect();
      const isClipped =
        activeBounds.left < viewportBounds.left + 12 || activeBounds.right > viewportBounds.right - 12;

      if (isClipped) {
        activeElement.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }

    syncShellState();

    const resizeObserver = new ResizeObserver(syncShellState);

    resizeObserver.observe(viewportElement);
    if (content instanceof HTMLElement) {
      resizeObserver.observe(content);
    }

    viewportElement.addEventListener("scroll", syncShellState, { passive: true });

    return () => {
      resizeObserver.disconnect();
      viewportElement.removeEventListener("scroll", syncShellState);
    };
  }, [activeSelector, watchKey]);

  return (
    <div
      className={cx("fg-control-strip-shell", `fg-control-strip-shell--${variant}`, className)}
      ref={shellRef}
    >
      <div
        className={cx("fg-control-strip__viewport", viewportClassName)}
        onWheel={handleWheel}
        ref={viewportRef}
      >
        {children}
      </div>
    </div>
  );
}
