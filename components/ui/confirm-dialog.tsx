"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { cx } from "@/lib/ui/cx";

type ConfirmDialogVariant = "danger" | "primary";
type ConfirmDialogTextConfirmation = {
  hint?: ReactNode;
  label?: string;
  matchText: string;
  mismatchMessage?: ReactNode;
};

export type ConfirmDialogOptions = {
  cancelLabel?: string;
  confirmLabel?: string;
  description?: ReactNode;
  eyebrow?: string;
  textConfirmation?: ConfirmDialogTextConfirmation;
  title: ReactNode;
  variant?: ConfirmDialogVariant;
};

type ConfirmDialogRecord = {
  cancelLabel: string;
  confirmLabel: string;
  description?: ReactNode;
  eyebrow: string;
  id: string;
  returnFocus: HTMLElement | null;
  textConfirmation?: ConfirmDialogTextConfirmation;
  title: ReactNode;
  variant: ConfirmDialogVariant;
  resolve: (value: boolean) => void;
};

type ConfirmDialogContextValue = {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
};

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function createConfirmDialogId() {
  return `confirm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTextConfirmationValue(value: string) {
  return value.trim();
}

function normalizeRecord(
  options: ConfirmDialogOptions,
  returnFocus: HTMLElement | null,
  resolve: (value: boolean) => void,
): ConfirmDialogRecord {
  const variant = options.variant ?? "danger";

  return {
    cancelLabel: options.cancelLabel ?? "Cancel",
    confirmLabel: options.confirmLabel ?? "Continue",
    description: options.description,
    eyebrow: options.eyebrow ?? (variant === "danger" ? "Destructive action" : "Confirm action"),
    id: createConfirmDialogId(),
    resolve,
    returnFocus,
    textConfirmation: options.textConfirmation,
    title: options.title,
    variant,
  };
}

function readFocusableElements(container: HTMLElement | null) {
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => {
      const style = window.getComputedStyle(element);

      return style.display !== "none" && style.visibility !== "hidden";
    },
  );
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  const [queue, setQueue] = useState<ConfirmDialogRecord[]>([]);
  const [textConfirmationInteracted, setTextConfirmationInteracted] = useState(false);
  const [textConfirmationValue, setTextConfirmationValue] = useState("");
  const queueRef = useRef<ConfirmDialogRecord[]>([]);
  const previousRecordRef = useRef<ConfirmDialogRecord | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textConfirmationInputRef = useRef<HTMLInputElement | null>(null);
  const backdropPressStartedRef = useRef(false);
  const activeRecord = queue[0] ?? null;
  const activeTextConfirmation = activeRecord?.textConfirmation ?? null;
  const titleId = activeRecord ? `fg-confirm-dialog-title-${activeRecord.id}` : undefined;
  const descriptionId =
    activeRecord?.description ? `fg-confirm-dialog-description-${activeRecord.id}` : undefined;
  const textConfirmationFieldId =
    activeRecord && activeTextConfirmation
      ? `fg-confirm-dialog-text-confirmation-${activeRecord.id}`
      : undefined;
  const textConfirmationHintId =
    activeRecord && activeTextConfirmation
      ? `fg-confirm-dialog-text-confirmation-hint-${activeRecord.id}`
      : undefined;
  const textConfirmationErrorId =
    activeRecord && activeTextConfirmation
      ? `fg-confirm-dialog-text-confirmation-error-${activeRecord.id}`
      : undefined;
  const normalizedTextConfirmationValue = normalizeTextConfirmationValue(textConfirmationValue);
  const textConfirmationMatches =
    !activeTextConfirmation ||
    normalizedTextConfirmationValue === activeTextConfirmation.matchText;
  const textConfirmationError =
    activeTextConfirmation &&
    textConfirmationInteracted &&
    normalizedTextConfirmationValue.length > 0 &&
    !textConfirmationMatches
      ? (activeTextConfirmation.mismatchMessage ??
        `Enter ${activeTextConfirmation.matchText} exactly to continue.`)
      : null;
  const textConfirmationHint =
    activeTextConfirmation?.hint ??
    (activeTextConfirmation
      ? `Type ${activeTextConfirmation.matchText} exactly to enable ${activeRecord?.confirmLabel.toLowerCase() ?? "continue"}.`
      : null);
  const textConfirmationDescriptionId = textConfirmationError
    ? textConfirmationErrorId
    : textConfirmationHintId;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    return () => {
      queueRef.current.forEach((record) => {
        record.resolve(false);
      });
      queueRef.current = [];
    };
  }, []);

  useEffect(() => {
    setTextConfirmationInteracted(false);
    setTextConfirmationValue("");
  }, [activeRecord?.id]);

  useEffect(() => {
    if (!activeRecord) {
      const previousRecord = previousRecordRef.current;

      if (previousRecord?.returnFocus) {
        window.requestAnimationFrame(() => {
          previousRecord.returnFocus?.focus();
        });
      }

      previousRecordRef.current = null;
      return;
    }

    previousRecordRef.current = activeRecord;
  }, [activeRecord]);

  useEffect(() => {
    if (!activeRecord) {
      return;
    }

    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [activeRecord]);

  useEffect(() => {
    if (!activeRecord) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const preferredButton =
        containerRef.current?.querySelector<HTMLElement>("[data-fg-confirm-dialog-cancel]") ??
        containerRef.current?.querySelector<HTMLElement>("[data-fg-confirm-dialog-confirm]");

      preferredButton?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeRecord]);

  const dismissActiveRecord = useCallback((value: boolean) => {
    const currentRecord = queueRef.current[0];

    if (!currentRecord) {
      return;
    }

    queueRef.current = queueRef.current.slice(1);
    setQueue(queueRef.current);
    currentRecord.resolve(value);
  }, []);

  const confirm = useCallback((options: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      const returnFocus =
        typeof document !== "undefined" && document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      setQueue((current) => [...current, normalizeRecord(options, returnFocus, resolve)]);
    });
  }, []);

  const contextValue = useMemo<ConfirmDialogContextValue>(
    () => ({
      confirm,
    }),
    [confirm],
  );

  function handleConfirm() {
    if (activeTextConfirmation && !textConfirmationMatches) {
      setTextConfirmationInteracted(true);
      textConfirmationInputRef.current?.focus();
      return;
    }

    dismissActiveRecord(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!activeRecord) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      dismissActiveRecord(false);
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusableElements = readFocusableElements(containerRef.current);

    if (!focusableElements.length) {
      event.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const activeInsideDialog = activeElement
      ? containerRef.current?.contains(activeElement)
      : false;

    if (event.shiftKey) {
      if (!activeInsideDialog || activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }

      return;
    }

    if (!activeInsideDialog || activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  function handleBackdropPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    backdropPressStartedRef.current = event.target === event.currentTarget;
  }

  function handleBackdropClick(event: ReactMouseEvent<HTMLDivElement>) {
    const shouldDismiss =
      backdropPressStartedRef.current && event.target === event.currentTarget;

    backdropPressStartedRef.current = false;

    if (!shouldDismiss) {
      return;
    }

    dismissActiveRecord(false);
  }

  return (
    <ConfirmDialogContext.Provider value={contextValue}>
      {children}
      {isMounted && activeRecord
        ? createPortal(
            <div
              className="fg-confirm-dialog-backdrop"
              data-state="open"
              onClick={handleBackdropClick}
              onPointerDown={handleBackdropPointerDown}
            >
              <div
                aria-describedby={descriptionId}
                aria-labelledby={titleId}
                aria-modal="true"
                className={cx(
                  "fg-confirm-dialog-shell",
                  activeRecord.variant === "danger" && "is-danger",
                )}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={handleKeyDown}
                ref={containerRef}
                role={activeRecord.variant === "danger" ? "alertdialog" : "dialog"}
              >
                <Panel className="fg-confirm-dialog-panel">
                  <PanelSection className="fg-confirm-dialog__section">
                    <p
                      className={cx(
                        "fg-label fg-panel__eyebrow fg-confirm-dialog__eyebrow",
                        activeRecord.variant === "danger" && "is-danger",
                      )}
                    >
                      {activeRecord.eyebrow}
                    </p>
                    <PanelTitle className="fg-confirm-dialog__title" id={titleId}>
                      {activeRecord.title}
                    </PanelTitle>
                    {activeRecord.description ? (
                      <PanelCopy className="fg-confirm-dialog__copy" id={descriptionId}>
                        {activeRecord.description}
                      </PanelCopy>
                    ) : null}
                    {activeTextConfirmation && textConfirmationFieldId ? (
                      <label
                        className="fg-field-stack fg-confirm-dialog__field"
                        htmlFor={textConfirmationFieldId}
                      >
                        <span className="fg-field-label">
                          <span>{activeTextConfirmation.label ?? "Type the name to confirm"}</span>
                        </span>
                        <span
                          className={cx(
                            "fg-field-control",
                            Boolean(textConfirmationError) && "is-invalid",
                          )}
                        >
                          <input
                            aria-describedby={textConfirmationDescriptionId}
                            aria-invalid={Boolean(textConfirmationError) || undefined}
                            autoCapitalize="none"
                            autoComplete="off"
                            autoCorrect="off"
                            className="fg-input"
                            id={textConfirmationFieldId}
                            inputMode="text"
                            name="confirmation"
                            onBlur={(event) => {
                              if (normalizeTextConfirmationValue(event.target.value).length > 0) {
                                setTextConfirmationInteracted(true);
                              }
                            }}
                            onChange={(event) => setTextConfirmationValue(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter") {
                                return;
                              }

                              event.preventDefault();
                              handleConfirm();
                            }}
                            ref={textConfirmationInputRef}
                            spellCheck={false}
                            type="text"
                            value={textConfirmationValue}
                          />
                        </span>
                        {textConfirmationError ? (
                          <span
                            aria-live="polite"
                            className="fg-field-error"
                            id={textConfirmationErrorId}
                          >
                            {textConfirmationError}
                          </span>
                        ) : textConfirmationHint ? (
                          <span className="fg-field-hint" id={textConfirmationHintId}>
                            {textConfirmationHint}
                          </span>
                        ) : null}
                      </label>
                    ) : null}
                  </PanelSection>

                  <PanelSection className="fg-confirm-dialog__actions">
                    <Button
                      data-fg-confirm-dialog-cancel
                      onClick={() => dismissActiveRecord(false)}
                      type="button"
                      variant="secondary"
                    >
                      {activeRecord.cancelLabel}
                    </Button>
                    <Button
                      data-fg-confirm-dialog-confirm
                      disabled={Boolean(activeTextConfirmation) && !textConfirmationMatches}
                      onClick={handleConfirm}
                      type="button"
                      variant={activeRecord.variant === "danger" ? "danger" : "primary"}
                    >
                      {activeRecord.confirmLabel}
                    </Button>
                  </PanelSection>
                </Panel>
              </div>
            </div>,
            document.body,
          )
        : null}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);

  if (!context) {
    throw new Error("useConfirmDialog must be used within ConfirmDialogProvider.");
  }

  return context.confirm;
}
