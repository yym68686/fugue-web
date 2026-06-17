"use client";

import { Alert, Button, CardContent, CardFrame } from "@/components/coss/ui";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <main className="coss-container coss-page">
      <CardFrame>
        <CardContent className="coss-stack">
          <Alert tone="destructive" title="Something went wrong">
            The page failed to render. Retry keeps the current route and asks React to recover.
          </Alert>
          <Button onClick={reset}>Retry</Button>
        </CardContent>
      </CardFrame>
    </main>
  );
}
