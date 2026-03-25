"use client";

import { useEffect, useRef } from "react";

import { useToast } from "@/components/ui/toast";

export function ToastOnMount({
  message,
  title,
  variant = "info",
}: {
  message: string | null;
  title?: string;
  variant?: "error" | "info" | "success";
}) {
  const { showToast } = useToast();
  const lastMessageRef = useRef<string | null>(null);
  const key = message ? `${variant}:${title ?? ""}:${message}` : null;

  useEffect(() => {
    if (!message || !key || lastMessageRef.current === key) {
      return;
    }

    lastMessageRef.current = key;
    showToast({
      message,
      title,
      variant,
    });
  }, [key, message, showToast, title, variant]);

  return null;
}
