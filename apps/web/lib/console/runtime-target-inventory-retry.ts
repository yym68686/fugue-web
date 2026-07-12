import {
  isAbortRequestError,
  isNetworkRequestError,
  readRequestErrorStatus,
  RequestError,
} from "@/lib/ui/request-json";

const RUNTIME_TARGET_RETRY_DELAYS_MS = [1_000, 3_000] as const;

export type RuntimeTargetRetryTimer = ReturnType<typeof globalThis.setTimeout>;
export type RuntimeTargetRetryScheduler = (
  callback: () => void,
  delayMs: number,
) => RuntimeTargetRetryTimer;

export function shouldRetryRuntimeTargetInventory(error: unknown) {
  if (isAbortRequestError(error)) {
    return false;
  }

  if (isNetworkRequestError(error)) {
    return true;
  }

  const status = readRequestErrorStatus(error);

  return (
    status === 408 ||
    status === 429 ||
    (status !== null && status >= 500 && status <= 599)
  );
}

export function readRuntimeTargetRetryDelayMs(error: unknown, attempt: number) {
  const scheduledDelay = RUNTIME_TARGET_RETRY_DELAYS_MS[attempt];

  if (scheduledDelay === undefined || !shouldRetryRuntimeTargetInventory(error)) {
    return null;
  }

  if (
    error instanceof RequestError &&
    error.status === 429 &&
    error.retryAfterSeconds !== null
  ) {
    return Math.max(scheduledDelay, error.retryAfterSeconds * 1_000);
  }

  return scheduledDelay;
}

export function scheduleRuntimeTargetInventoryRetry(
  error: unknown,
  attempt: number,
  callback: () => void,
  schedule: RuntimeTargetRetryScheduler = globalThis.setTimeout,
) {
  const delay = readRuntimeTargetRetryDelayMs(error, attempt);

  return delay === null ? null : schedule(callback, delay);
}
