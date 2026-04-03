"use client";

import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  WheelEvent,
} from "react";
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

const POINTER_DRAG_THRESHOLD = 8;

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
  const pointerStateRef = useRef({
    pointerId: null as number | null,
    startX: 0,
    startY: 0,
  });
  const suppressClickRef = useRef(false);

  function clearPointerTracking({ keepSuppressedClick = false } = {}) {
    pointerStateRef.current.pointerId = null;
    pointerStateRef.current.startX = 0;
    pointerStateRef.current.startY = 0;

    if (!keepSuppressedClick) {
      suppressClickRef.current = false;
    }
  }

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

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") {
      return;
    }

    pointerStateRef.current.pointerId = event.pointerId;
    pointerStateRef.current.startX = event.clientX;
    pointerStateRef.current.startY = event.clientY;
    suppressClickRef.current = false;
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerStateRef.current.pointerId !== event.pointerId || suppressClickRef.current) {
      return;
    }

    const deltaX = Math.abs(event.clientX - pointerStateRef.current.startX);
    const deltaY = Math.abs(event.clientY - pointerStateRef.current.startY);

    if (deltaX < POINTER_DRAG_THRESHOLD || deltaX <= deltaY) {
      return;
    }

    suppressClickRef.current = true;
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerStateRef.current.pointerId !== event.pointerId) {
      return;
    }

    clearPointerTracking({
      keepSuppressedClick: suppressClickRef.current,
    });
  }

  function handleClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (!suppressClickRef.current) {
      return;
    }

    clearPointerTracking();

    const target = event.target;

    if (!(target instanceof Element) || !target.closest("a, button, [role='button'], [role='tab']")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
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
        onClickCapture={handleClickCapture}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onWheel={handleWheel}
        ref={viewportRef}
      >
        {children}
      </div>
    </div>
  );
}
