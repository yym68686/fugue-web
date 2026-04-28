"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function parseCssDurationToMs(value: string) {
  const firstValue = value.split(",")[0]?.trim();

  if (!firstValue) {
    return null;
  }

  const numeric = Number.parseFloat(firstValue);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return firstValue.endsWith("ms") ? numeric : numeric * 1000;
}

export function readCssDurationMs(propertyName: string, fallbackMs: number) {
  if (typeof window === "undefined") {
    return fallbackMs;
  }

  const rawValue = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(propertyName);

  return parseCssDurationToMs(rawValue) ?? fallbackMs;
}

export function useTransitionPresence({
  closePropertyName,
  fallbackCloseMs,
  initialOpen = false,
}: {
  closePropertyName: string;
  fallbackCloseMs: number;
  initialOpen?: boolean;
}) {
  const [open, setOpenState] = useState(initialOpen);
  const [present, setPresent] = useState(initialOpen);
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const openFrameRef = useRef<number | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current === null) {
      return;
    }

    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const clearOpenFrame = useCallback(() => {
    if (openFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(openFrameRef.current);
    openFrameRef.current = null;
  }, []);

  const close = useCallback(
    (immediate = false) => {
      clearOpenFrame();
      setOpenState(false);

      if (immediate || typeof window === "undefined") {
        clearCloseTimer();
        setClosing(false);
        setPresent(false);
        return;
      }

      clearCloseTimer();
      setClosing(true);

      closeTimerRef.current = window.setTimeout(() => {
        closeTimerRef.current = null;
        setClosing(false);
        setPresent(false);
      }, readCssDurationMs(closePropertyName, fallbackCloseMs));
    },
    [clearCloseTimer, clearOpenFrame, closePropertyName, fallbackCloseMs],
  );

  const openPresence = useCallback(() => {
    if (typeof window === "undefined") {
      setPresent(true);
      setClosing(false);
      setOpenState(true);
      return;
    }

    clearCloseTimer();
    clearOpenFrame();
    setPresent(true);
    setClosing(false);

    openFrameRef.current = window.requestAnimationFrame(() => {
      openFrameRef.current = null;
      setOpenState(true);
    });
  }, [clearCloseTimer, clearOpenFrame]);

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        openPresence();
        return;
      }

      close();
    },
    [close, openPresence],
  );

  const toggle = useCallback(() => {
    if (open) {
      close();
      return;
    }

    openPresence();
  }, [close, open, openPresence]);

  useEffect(() => {
    return () => {
      clearCloseTimer();
      clearOpenFrame();
    };
  }, [clearCloseTimer, clearOpenFrame]);

  return {
    close,
    closing,
    open,
    openPresence,
    present,
    setOpen,
    toggle,
  };
}
