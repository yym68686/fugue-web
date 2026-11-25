"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

export default function Modal({ title, children, onDismiss, dismissDisabled = false }: {
  title: string;
  children: ReactNode;
  onDismiss: () => void;
  dismissDisabled?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    return () => {
      element.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="modal-card ui-modal"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (!dismissDisabled) onDismiss();
      }}
    >
      {children}
    </dialog>
  );
}
