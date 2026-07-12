"use client";

import { Alert, AlertDescription } from "@/registry/default/ui/alert";
import { Button } from "@/registry/default/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/registry/default/ui/field";
import { Form } from "@/registry/default/ui/form";
import { Input } from "@/registry/default/ui/input";

export default function FugueAuthFormParticle() {
  return (
    <Form
      className="mx-auto grid w-full max-w-sm gap-5 rounded-2xl border bg-card p-6"
      onSubmit={(event) => event.preventDefault()}
    >
      <div>
        <h2 className="text-xl font-semibold">Sign in to Fugue</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Use a workspace email or continue with a provider.
        </p>
      </div>
      <Alert variant="info">
        <AlertDescription>
          This example never submits credentials or contacts a provider.
        </AlertDescription>
      </Alert>
      <FieldGroup>
        <Field name="email">
          <FieldLabel>Email</FieldLabel>
          <Input
            autoComplete="email"
            name="email"
            placeholder="you@example.com"
            required
            type="email"
          />
          <FieldDescription>We send a one-time sign-in link.</FieldDescription>
        </Field>
      </FieldGroup>
      <Button type="submit">Continue</Button>
      <Button type="button" variant="outline">
        Continue with GitHub
      </Button>
    </Form>
  );
}
