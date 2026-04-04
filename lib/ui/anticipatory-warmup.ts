"use client";

import { useEffect, type DependencyList } from "react";

type IdleCallbackHandle = number;
type IdleCallbackOptions = {
  timeout?: number;
};
type IdleDeadline = {
  didTimeout: boolean;
  timeRemaining: () => number;
};
type IdleCallbackWindow = Window &
  typeof globalThis & {
    cancelIdleCallback?: (handle: IdleCallbackHandle) => void;
    requestIdleCallback?: (
      callback: (deadline: IdleDeadline) => void,
      options?: IdleCallbackOptions,
    ) => IdleCallbackHandle;
  };

type WarmupMode = "idle" | "immediate";

export function useAnticipatoryWarmup(
  warmup: ((signal: AbortSignal) => void | Promise<void>) | null,
  deps: DependencyList,
  options?: {
    enabled?: boolean;
    mode?: WarmupMode;
    skipWhenHidden?: boolean;
    timeoutMs?: number;
  },
) {
  const enabled = options?.enabled ?? true;
  const mode = options?.mode ?? "idle";
  const skipWhenHidden = options?.skipWhenHidden ?? true;
  const timeoutMs = options?.timeoutMs ?? 1_500;

  useEffect(() => {
    if (!enabled || !warmup) {
      return;
    }

    if (
      skipWhenHidden &&
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    ) {
      return;
    }

    const controller = new AbortController();
    let idleHandle: IdleCallbackHandle | null = null;
    let timerHandle: number | null = null;

    const runWarmup = () => {
      if (controller.signal.aborted) {
        return;
      }

      void warmup(controller.signal);
    };

    if (mode === "idle") {
      const idleWindow =
        typeof window === "undefined"
          ? null
          : (window as IdleCallbackWindow);

      if (idleWindow?.requestIdleCallback) {
        idleHandle = idleWindow.requestIdleCallback(() => {
          runWarmup();
        }, { timeout: timeoutMs });
      } else {
        timerHandle = window.setTimeout(runWarmup, 0);
      }
    } else {
      timerHandle = window.setTimeout(runWarmup, 0);
    }

    return () => {
      controller.abort();

      const idleWindow =
        typeof window === "undefined"
          ? null
          : (window as IdleCallbackWindow);

      if (idleHandle !== null && idleWindow?.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleHandle);
      }

      if (timerHandle !== null) {
        window.clearTimeout(timerHandle);
      }
    };
  }, [enabled, mode, skipWhenHidden, timeoutMs, warmup, ...deps]);
}
