"use client";


// @generated from apps/ui/registry/default by apps/ui/scripts/sync-ui.ts — DO NOT EDIT.
import { CheckboxGroup as CheckboxGroupPrimitive } from "@base-ui/react/checkbox-group";
import type React from "react";
import { cn } from "@fugue/ui/lib/utils";

export function CheckboxGroup({
  className,
  ...props
}: CheckboxGroupPrimitive.Props): React.ReactElement {
  return (
    <CheckboxGroupPrimitive
      className={cn("flex flex-col items-start gap-3", className)}
      {...props}
    />
  );
}

export { CheckboxGroupPrimitive };
