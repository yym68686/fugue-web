// @generated from apps/ui/registry/default by apps/ui/scripts/sync-ui.ts — DO NOT EDIT.
import { Loader2Icon } from "lucide-react";
import type React from "react";
import { cn } from "@fugue/ui/lib/utils";

export function Spinner({
  className,
  ...props
}: React.ComponentProps<typeof Loader2Icon>): React.ReactElement {
  return (
    <Loader2Icon
      aria-label="Loading"
      className={cn("animate-spin", className)}
      role="status"
      {...props}
    />
  );
}
