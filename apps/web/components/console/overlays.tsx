"use client";

import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@fugue/ui/components/alert-dialog";
import { Button } from "@fugue/ui/components/button";
import {
  Drawer,
  DrawerClose,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@fugue/ui/components/drawer";
import { Spinner } from "@fugue/ui/components/spinner";
import { X } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from "react";
import { useClientUiMessages } from "@/components/i18n/locale-select";

function joinDescriptionIds(...ids: Array<string | undefined>) {
  const describedBy = ids.filter((id): id is string => Boolean(id)).join(" ");
  return describedBy || undefined;
}

export function ConsoleDrawer({
  title,
  description,
  open,
  returnFocusId,
  onClose,
  children,
  error,
  footer,
}: {
  title: string;
  description?: string;
  open: boolean;
  returnFocusId?: string;
  onClose: () => void;
  children: ReactNode;
  error?: ReactNode;
  footer?: ReactNode;
}) {
  const messages = useClientUiMessages();
  const overlayId = useId();
  const titleId = `${overlayId}-title`;
  const descriptionId = `${overlayId}-description`;
  const errorId = `${overlayId}-error`;
  const hasError = error !== undefined && error !== null;
  const describedBy = joinDescriptionIds(
    description ? descriptionId : undefined,
    hasError ? errorId : undefined,
  );
  const popupRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const interactionTargetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const rememberInteractionTarget = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      interactionTargetRef.current =
        target.closest<HTMLElement>(
          'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? target;
    };

    // Capture runs before React's opener handler changes `open`, so focus can
    // be restored even when Base UI moves it into the portal before effects.
    document.addEventListener("click", rememberInteractionTarget, true);
    document.addEventListener("keydown", rememberInteractionTarget, true);
    document.addEventListener("pointerdown", rememberInteractionTarget, true);
    return () => {
      document.removeEventListener("click", rememberInteractionTarget, true);
      document.removeEventListener("keydown", rememberInteractionTarget, true);
      document.removeEventListener("pointerdown", rememberInteractionTarget, true);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const background = document.querySelector<HTMLElement>(".coss-root");
    const wasInert = background?.inert ?? false;
    returnFocusRef.current =
      (returnFocusId ? document.getElementById(returnFocusId) : null) ??
      interactionTargetRef.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);

    if (background) {
      background.inert = true;
    }

    return () => {
      if (background) {
        background.inert = wasInert;
      }
    };
  }, [open, returnFocusId]);

  function containControlledDrawerFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") {
      return;
    }

    const popup = popupRef.current;
    if (!popup) {
      return;
    }

    const focusable = Array.from(
      popup.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(
      (element) => !element.hidden && element.getAttribute("aria-hidden") !== "true",
    );
    const first = focusable[0];
    const last = focusable.at(-1);

    if (!first || !last) {
      return;
    }

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    // Product controls open these overlays through React state instead of a
    // DrawerTrigger. Focus restoration is therefore handled above; associating
    // an unregistered Base UI trigger id makes the opening pointer event count
    // as an outside dismissal.
    <Drawer
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) {
          const returnTarget = returnFocusRef.current;
          if (returnTarget?.isConnected && !returnTarget.matches(":disabled")) {
            returnTarget.focus();
          } else {
            document.getElementById("main-content")?.focus();
          }
        }
      }}
      open={open}
      position="right"
    >
      <DrawerPopup
        aria-describedby={describedBy}
        aria-labelledby={titleId}
        onKeyDown={containControlledDrawerFocus}
        position="right"
        ref={popupRef}
      >
        <DrawerClose
          aria-label={messages.close}
          className="absolute end-2 top-2"
          render={<Button size="icon" variant="ghost" />}
        >
          <X aria-hidden="true" />
        </DrawerClose>
        <DrawerHeader>
          <DrawerTitle id={titleId}>{title}</DrawerTitle>
          {description ? (
            <DrawerDescription id={descriptionId}>{description}</DrawerDescription>
          ) : null}
        </DrawerHeader>
        <DrawerPanel>
          {hasError ? (
            <div id={errorId} role="alert">
              {error}
            </div>
          ) : null}
          {children}
        </DrawerPanel>
        {footer ? <DrawerFooter>{footer}</DrawerFooter> : null}
      </DrawerPopup>
    </Drawer>
  );
}

export function ConfirmationDialog({
  title,
  description,
  open,
  confirmDisabled = false,
  confirmLabel,
  confirmLoading = false,
  confirmVariant = "default",
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  open: boolean;
  confirmDisabled?: boolean;
  confirmLabel?: string;
  confirmLoading?: boolean;
  confirmVariant?: "default" | "destructive";
  error?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const messages = useClientUiMessages();
  const overlayId = useId();
  const titleId = `${overlayId}-title`;
  const descriptionId = `${overlayId}-description`;
  const errorId = `${overlayId}-error`;
  const hasError = error !== undefined && error !== null;
  const describedBy = joinDescriptionIds(descriptionId, hasError ? errorId : undefined);
  const resolvedConfirmLabel = confirmLabel ?? messages.confirm;

  return (
    <AlertDialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !confirmLoading) onClose();
      }}
      open={open}
    >
      <AlertDialogPopup aria-describedby={describedBy} aria-labelledby={titleId}>
        <AlertDialogHeader>
          <AlertDialogTitle id={titleId}>{title}</AlertDialogTitle>
          <AlertDialogDescription id={descriptionId}>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {hasError ? (
          <div id={errorId} role="alert">
            {error}
          </div>
        ) : null}
        <AlertDialogFooter>
          <Button disabled={confirmLoading} onClick={onClose} variant="outline">
            {messages.cancel}
          </Button>
          <Button
            aria-busy={confirmLoading || undefined}
            disabled={confirmDisabled || confirmLoading}
            onClick={onConfirm}
            variant={confirmVariant}
          >
            {confirmLoading ? <Spinner aria-hidden="true" /> : null}
            {resolvedConfirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
