"use client";

import { useEffect, useState } from "react";

const OBSERVED_STATUS_TICK_MS = 15_000;

/**
 * Keep evidence-bound UI honest after hydration. The server supplies the
 * initial timestamp so the first client render is deterministic; subsequent
 * ticks make a once-fresh observation automatically lose its green state.
 */
export function useObservedStatusNow(initialNow: number): number {
  const [now, setNow] = useState(initialNow);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), OBSERVED_STATUS_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}
