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

type ToastVariant = "error" | "info" | "success";

type ToastInput = {
  duration?: number;
  message: string;
  title?: string;
  variant?: ToastVariant;
};

type ToastRecord = ToastInput & {
  id: string;
  state: "closing" | "open";
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

  const stackLabel =
    isFront && total > 1 ? (expanded ? "Fold" : `+${total - 1}`) : null;

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

        <button
          aria-label="Dismiss notification"
          className="fg-toast__dismiss"
          onClick={() => onDismiss(toast.id)}
          type="button"
        >
          Close
        </button>
      </div>
    </article>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const dismissalTimers = useRef<Map<string, number>>(new Map());
  const [stackExpanded, setStackExpanded] = useState(false);
  const [stackPaused, setStackPaused] = useState(false);
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  useEffect(() => {
    return () => {
      dismissalTimers.current.forEach((timeout) => {
        window.clearTimeout(timeout);
      });
      dismissalTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (toasts.length < 2) {
      setStackExpanded(false);
    }
  }, [toasts.length]);

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

  const showToast = useCallback((toast: ToastInput) => {
    const id = createToastId();

    setToasts((current) =>
      [
        ...current,
        {
          ...toast,
          id,
          state: "open" as const,
          variant: toast.variant ?? "info",
        },
      ].slice(-MAX_TOASTS),
    );

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
                isFront={index === toasts.length - 1}
                key={toast.id}
                onDismiss={dismissToast}
                onToggleExpand={() => {
                  if (toasts.length < 2) {
                    return;
                  }

                  setStackExpanded((current) => !current);
                }}
                pauseDismiss={stackPaused || stackExpanded}
                toast={toast}
                total={toasts.length}
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
