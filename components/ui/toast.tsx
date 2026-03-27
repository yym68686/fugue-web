"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { copyText } from "@/lib/ui/clipboard";

type ToastVariant = "error" | "info" | "success";

type ToastInput = {
  duration?: number;
  message: string;
  title?: string;
  variant?: ToastVariant;
};

type ToastRecord = ToastInput & {
  id: string;
  state: "closing" | "entering" | "open";
  variant: ToastVariant;
};

type ToastContextValue = {
  dismissToast: (id: string) => void;
  showToast: (toast: ToastInput) => string;
};

const MAX_TOASTS = 4;
const TOAST_EXIT_DURATION_MS = 180;
const ToastContext = createContext<ToastContextValue | null>(null);

function createToastId() {
  return `toast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getToastTitle(toast: Pick<ToastInput, "title" | "variant">) {
  if (toast.title) {
    return toast.title;
  }

  if (toast.variant === "error") {
    return "Action failed";
  }

  if (toast.variant === "success") {
    return "Confirmed";
  }

  return "Notice";
}

function ToastItem({
  depth,
  expanded,
  isFront,
  onDismiss,
  onToggleExpand,
  pauseDismiss,
  toast,
  total,
}: {
  depth: number;
  expanded: boolean;
  isFront: boolean;
  onDismiss: (id: string) => void;
  onToggleExpand: () => void;
  pauseDismiss: boolean;
  toast: ToastRecord;
  total: number;
}) {
  const copiedResetRef = useRef<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (pauseDismiss || toast.state === "closing") {
      return;
    }

    const timeout = window.setTimeout(
      () => onDismiss(toast.id),
      toast.duration ?? 4200,
    );

    return () => window.clearTimeout(timeout);
  }, [onDismiss, pauseDismiss, toast.duration, toast.id, toast.state]);

  useEffect(() => {
    setCopied(false);

    if (copiedResetRef.current !== null) {
      window.clearTimeout(copiedResetRef.current);
      copiedResetRef.current = null;
    }

    return () => {
      if (copiedResetRef.current !== null) {
        window.clearTimeout(copiedResetRef.current);
      }
    };
  }, [toast.id]);

  const stackLabel =
    isFront && total > 1 ? (expanded ? "Fold" : `+${total - 1}`) : null;

  async function handleCopy() {
    const didCopy = await copyText(toast.message);

    if (!didCopy) {
      return;
    }

    setCopied(true);

    if (copiedResetRef.current !== null) {
      window.clearTimeout(copiedResetRef.current);
    }

    copiedResetRef.current = window.setTimeout(() => {
      setCopied(false);
      copiedResetRef.current = null;
    }, 1400);
  }

  return (
    <article
      aria-atomic="true"
      className={`fg-toast fg-toast--${toast.variant}`}
      data-state={toast.state}
      role={toast.variant === "error" ? "alert" : "status"}
      style={
        {
          "--fg-toast-depth": depth,
        } as CSSProperties
      }
    >
      <div className="fg-toast__shell">
        <button
          aria-expanded={total > 1 ? expanded : undefined}
          className="fg-toast__toggle"
          onClick={onToggleExpand}
          type="button"
        >
          <div className="fg-toast__eyebrow">
            <span aria-hidden="true" className="fg-toast__tone" />
            <strong>{getToastTitle(toast)}</strong>
            {stackLabel ? (
              <span className="fg-toast__stack-label">{stackLabel}</span>
            ) : null}
          </div>

          <p className="fg-toast__message">{toast.message}</p>
        </button>

        <div className="fg-toast__actions">
          <button
            aria-label="Copy notification message"
            className="fg-toast__action"
            onClick={() => {
              void handleCopy();
            }}
            type="button"
          >
            {copied ? "Copied" : "Copy"}
          </button>

          <button
            aria-label="Dismiss notification"
            className="fg-toast__action"
            onClick={() => onDismiss(toast.id)}
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </article>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const dismissalTimers = useRef<Map<string, number>>(new Map());
  const [stackExpanded, setStackExpanded] = useState(false);
  const [stackPaused, setStackPaused] = useState(false);
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const activeToasts = toasts.filter((toast) => toast.state !== "closing");
  const activeToastCount = activeToasts.length;
  const oldestActiveToastId = activeToasts[0]?.id ?? null;
  const frontToastId = activeToasts.at(-1)?.id ?? toasts.at(-1)?.id ?? null;

  useEffect(() => {
    return () => {
      dismissalTimers.current.forEach((timeout) => {
        window.clearTimeout(timeout);
      });
      dismissalTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (activeToastCount < 2) {
      setStackExpanded(false);
    }
  }, [activeToastCount]);

  useEffect(() => {
    const enteringIds = toasts
      .filter((toast) => toast.state === "entering")
      .map((toast) => toast.id);

    if (enteringIds.length === 0) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setToasts((current) =>
        current.map((toast) =>
          enteringIds.includes(toast.id) && toast.state === "entering"
            ? {
                ...toast,
                state: "open",
              }
            : toast,
        ),
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [toasts]);

  const finalizeDismiss = useCallback((id: string) => {
    const timeout = dismissalTimers.current.get(id);

    if (timeout) {
      window.clearTimeout(timeout);
      dismissalTimers.current.delete(id);
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const dismissToast = useCallback(
    (id: string) => {
      setToasts((current) =>
        current.map((toast) =>
          toast.id === id && toast.state !== "closing"
            ? {
                ...toast,
                state: "closing",
              }
            : toast,
        ),
      );

      if (dismissalTimers.current.has(id)) {
        return;
      }

      const timeout = window.setTimeout(() => {
        dismissalTimers.current.delete(id);
        finalizeDismiss(id);
      }, TOAST_EXIT_DURATION_MS);

      dismissalTimers.current.set(id, timeout);
    },
    [finalizeDismiss],
  );

  useEffect(() => {
    if (activeToastCount <= MAX_TOASTS || oldestActiveToastId === null) {
      return;
    }

    dismissToast(oldestActiveToastId);
  }, [activeToastCount, dismissToast, oldestActiveToastId]);

  const showToast = useCallback((toast: ToastInput) => {
    const id = createToastId();

    setToasts((current) => [
      ...current,
      {
        ...toast,
        id,
        state: "entering" as const,
        variant: toast.variant ?? "info",
      },
    ]);

    return id;
  }, []);

  const value = useMemo(
    () => ({
      dismissToast,
      showToast,
    }),
    [dismissToast, showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions text"
        className="fg-toast-region"
      >
        <div
          className="fg-toast-stack"
          data-expanded={stackExpanded ? "true" : "false"}
          onBlurCapture={(event) => {
            const nextTarget = event.relatedTarget;

            if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
              setStackPaused(false);
            }
          }}
          onFocusCapture={() => {
            setStackPaused(true);
          }}
          onMouseEnter={() => {
            setStackPaused(true);
          }}
          onMouseLeave={() => {
            setStackPaused(false);
          }}
        >
          {toasts.map((toast, index) => {
            const depth = toasts.length - index - 1;

            return (
              <ToastItem
                depth={depth}
                expanded={stackExpanded}
                isFront={toast.id === frontToastId}
                key={toast.id}
                onDismiss={dismissToast}
                onToggleExpand={() => {
                  if (activeToastCount < 2) {
                    return;
                  }

                  setStackExpanded((current) => !current);
                }}
                pauseDismiss={stackPaused || stackExpanded}
                toast={toast}
                total={activeToastCount}
              />
            );
          })}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider.");
  }

  return context;
}
