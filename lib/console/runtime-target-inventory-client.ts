"use client";

import { useEffect, useState } from "react";

import type { ConsoleRuntimeTargetInventoryData } from "@/lib/console/gallery-types";
import {
  createAbortRequestError,
  isAbortRequestError,
  readRequestError,
  requestJson,
} from "@/lib/ui/request-json";

const RUNTIME_TARGET_CACHE_TTL_MS = 60_000;

type RuntimeTargetInventoryState = ConsoleRuntimeTargetInventoryData & {
  loading: boolean;
};

let cachedRuntimeTargetInventory: ConsoleRuntimeTargetInventoryData | null = null;
let cachedRuntimeTargetInventoryAt = 0;
let runtimeTargetInventoryRequest: Promise<ConsoleRuntimeTargetInventoryData> | null =
  null;

function hasFreshRuntimeTargetInventory() {
  return (
    cachedRuntimeTargetInventory !== null &&
    Date.now() - cachedRuntimeTargetInventoryAt < RUNTIME_TARGET_CACHE_TTL_MS
  );
}

async function loadRuntimeTargetInventory(force = false) {
  if (!force && hasFreshRuntimeTargetInventory()) {
    return cachedRuntimeTargetInventory as ConsoleRuntimeTargetInventoryData;
  }

  if (!force && runtimeTargetInventoryRequest) {
    return runtimeTargetInventoryRequest;
  }

  runtimeTargetInventoryRequest = requestJson<ConsoleRuntimeTargetInventoryData>(
    "/api/fugue/console/runtime-targets",
    {
      cache: "no-store",
    },
  )
    .then((data) => {
      cachedRuntimeTargetInventory = data;
      cachedRuntimeTargetInventoryAt = Date.now();
      return data;
    })
    .finally(() => {
      runtimeTargetInventoryRequest = null;
    });

  return runtimeTargetInventoryRequest;
}

export async function warmConsoleRuntimeTargetInventory(options?: {
  force?: boolean;
  signal?: AbortSignal;
}) {
  if (options?.signal?.aborted) {
    throw createAbortRequestError();
  }

  try {
    return await loadRuntimeTargetInventory(options?.force);
  } catch (error) {
    if (options?.signal?.aborted || isAbortRequestError(error)) {
      throw createAbortRequestError();
    }

    throw error;
  }
}

export function useConsoleRuntimeTargetInventory(enabled: boolean) {
  const [state, setState] = useState<RuntimeTargetInventoryState>(() =>
    hasFreshRuntimeTargetInventory()
      ? {
          ...(cachedRuntimeTargetInventory as ConsoleRuntimeTargetInventoryData),
          loading: false,
        }
      : {
          runtimeTargetInventoryError: null,
          runtimeTargets: [],
          loading: enabled,
        },
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    if (!hasFreshRuntimeTargetInventory()) {
      setState((current) => ({
        ...current,
        loading: true,
      }));
    }

    loadRuntimeTargetInventory()
      .then((data) => {
        if (cancelled) {
          return;
        }

        setState({
          ...data,
          loading: false,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setState({
          loading: false,
          runtimeTargetInventoryError: readRequestError(error),
          runtimeTargets: [],
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return state;
}

export function invalidateConsoleRuntimeTargetInventory() {
  cachedRuntimeTargetInventory = null;
  cachedRuntimeTargetInventoryAt = 0;
  runtimeTargetInventoryRequest = null;
}
