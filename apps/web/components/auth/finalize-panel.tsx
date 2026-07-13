"use client";

import { Alert, AlertDescription, AlertTitle } from "@fugue/ui/components/alert";
import { Badge } from "@fugue/ui/components/badge";
import { Button } from "@fugue/ui/components/button";
import { Card, CardContent } from "@fugue/ui/components/card";
import { Form } from "@fugue/ui/components/form";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { AuthFinalizeMessages } from "@/lib/auth/ui-messages";

export function FinalizePanel({ messages }: { messages: AuthFinalizeMessages }) {
  const [token, setToken] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    setToken(window.location.hash.replace(/^#/, "").trim());
  }, []);

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        {token === "" ? (
          <Alert variant="warning">
            <AlertTitle>{messages.handoffTokenMissingTitle}</AlertTitle>
            <AlertDescription>
              {messages.handoffTokenMissingDescription}
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-col gap-2">
          <Badge aria-live="polite" variant={token === "" ? "warning" : "info"}>
            {validating || token === null
              ? messages.validating
              : token
                ? messages.ready
                : messages.missingToken}
          </Badge>
          <p className="text-muted-foreground text-sm">{messages.handoffDescription}</p>
        </div>
        <Form
          action="/auth/finalize/complete"
          className="flex flex-wrap items-center gap-2"
          method="post"
          onSubmit={() => setValidating(true)}
        >
          <input name="token" readOnly type="hidden" value={token ?? ""} />
          <Button disabled={!token} loading={validating} type="submit">
            {messages.completeSession}
          </Button>
          <Button render={<Link href="/auth/sign-in" />} variant="ghost">
            {messages.restartSignIn}
          </Button>
        </Form>
      </CardContent>
    </Card>
  );
}
