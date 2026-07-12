"use client";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@fugue/ui/components/alert";
import { Button } from "@fugue/ui/components/button";
import type { ReactNode } from "react";

export function ConsoleLoadingState({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: This status region can contain structural placeholders that are invalid inside output.
    <div
      aria-busy="true"
      aria-label={label}
      aria-live="polite"
      className={className}
      role="status"
    >
      {children}
    </div>
  );
}

export function ConsoleLoadError({
  description,
  onRetry,
  retryLabel,
  title,
}: {
  description: string;
  onRetry: () => Promise<unknown> | unknown;
  retryLabel?: string;
  title: string;
}) {
  return (
    <Alert variant="error" role="alert">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      <AlertAction>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void Promise.resolve(onRetry()).catch(() => undefined);
          }}
        >
          {retryLabel}
        </Button>
      </AlertAction>
    </Alert>
  );
}
