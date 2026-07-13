"use client";


// @generated from apps/ui/registry/default by apps/ui/scripts/sync-ui.ts — DO NOT EDIT.
import { Fieldset as FieldsetPrimitive } from "@base-ui/react/fieldset";
import type React from "react";
import { cn } from "@fugue/ui/lib/utils";

export function Fieldset({
  className,
  ...props
}: FieldsetPrimitive.Root.Props): React.ReactElement {
  return (
    <FieldsetPrimitive.Root
      className={className}
      data-slot="fieldset"
      {...props}
    />
  );
}
export function FieldsetLegend({
  className,
  ...props
}: FieldsetPrimitive.Legend.Props): React.ReactElement {
  return (
    <FieldsetPrimitive.Legend
      className={cn("font-semibold text-foreground", className)}
      data-slot="fieldset-legend"
      {...props}
    />
  );
}

export { FieldsetPrimitive };
