"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/registry/default/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/registry/default/ui/field";
import { Input } from "@/registry/default/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/registry/default/ui/input-group";

export default function FugueEnvironmentEditorParticle() {
  return (
    <section
      aria-labelledby="environment-title"
      className="grid gap-5 rounded-2xl border bg-card p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" id="environment-title">
            Environment
          </h2>
          <p className="text-muted-foreground text-sm">
            Example values are intentionally non-sensitive.
          </p>
        </div>
        <Button size="sm" type="button" variant="outline">
          <PlusIcon aria-hidden="true" />
          Add variable
        </Button>
      </div>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="env-key">Key</FieldLabel>
          <Input id="env-key" name="key" defaultValue="APP_PUBLIC_URL" />
        </Field>
        <Field>
          <FieldLabel htmlFor="env-value">Value</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="env-value"
              name="value"
              defaultValue="https://example.invalid"
            />
            <InputGroupAddon align="inline-end">
              <Button
                aria-label="Remove variable"
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <Trash2Icon aria-hidden="true" />
              </Button>
            </InputGroupAddon>
          </InputGroup>
          <FieldDescription>
            Real product values are never included in registry examples.
          </FieldDescription>
        </Field>
      </FieldGroup>
    </section>
  );
}
