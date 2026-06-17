"use client";

import { Alert, Button, CardContent, CardFrame } from "@/components/coss/ui";
import { ConsoleShell } from "@/components/fugue-coss/shells";

export default function ConsoleError({ reset }: { reset: () => void }) {
  return (
    <ConsoleShell>
      <CardFrame>
        <CardContent className="coss-stack">
          <Alert tone="destructive" title="Console surface failed">
            The protected workspace view could not render. Retry without leaving the console.
          </Alert>
          <Button onClick={reset}>Retry console</Button>
        </CardContent>
      </CardFrame>
    </ConsoleShell>
  );
}
