"use client";

import { startTransition, useEffect, useRef, useState } from "react";

import {
  isAbortRequestError,
  readRequestError,
  readRequestErrorStatus,
  requestJson,
} from "@/lib/ui/request-json";

export function useDebouncedValue<T>(value: T, delayMs = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      startTransition(() => setDebouncedValue(value));
    }, delayMs);

    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}

export function useBoundedConsolePage<T>(
  requestUrl: string,
  options?: {
    enabled?: boolean;
    onCursorExpired?: () => void;
  },
) {
  const enabled = options?.enabled ?? true;
  const onCursorExpiredRef = useRef(options?.onCursorExpired);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    onCursorExpiredRef.current = options?.onCursorExpired;
  }, [options?.onCursorExpired]);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setError(null);
      setLoading(true);
      return;
    }

    const controller = new AbortController();
    let active = true;

    setData(null);
    setError(null);
    setLoading(true);

    requestJson<T>(requestUrl, {
      cache: "no-store",
      headers: {
        "X-Fugue-Refresh-Version": String(refreshVersion),
      },
      signal: controller.signal,
    })
      .then((nextData) => {
        if (!active) {
          return;
        }
        startTransition(() => {
          setData(nextData);
          setError(null);
          setLoading(false);
        });
      })
      .catch((nextError) => {
        if (!active || isAbortRequestError(nextError)) {
          return;
        }
        if (
          readRequestErrorStatus(nextError) === 409 &&
          new URL(requestUrl, window.location.origin).searchParams.has("cursor")
        ) {
          setLoading(false);
          onCursorExpiredRef.current?.();
          return;
        }
        setError(readRequestError(nextError));
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [enabled, refreshVersion, requestUrl]);

  return {
    data,
    error,
    loading,
    refresh: () => setRefreshVersion((version) => version + 1),
  };
}
