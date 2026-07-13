"use client";

import { Alert, AlertDescription, AlertTitle } from "@fugue/ui/components/alert";
import { Button } from "@fugue/ui/components/button";
import { Card, CardContent } from "@fugue/ui/components/card";
import { useEffect } from "react";
import { reportClientError } from "@/components/shared/client-telemetry";
import { useClientUiMessages } from "@/components/i18n/locale-select";

export default function ConsoleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const messages = useClientUiMessages();

  useEffect(() => {
    if (error) reportClientError("console-boundary");
  }, [error]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Alert variant="error">
          <AlertTitle>{messages.consoleRenderFailedTitle}</AlertTitle>
          <AlertDescription>{messages.consoleRenderFailedDescription}</AlertDescription>
        </Alert>
        <Button onClick={reset}>{messages.retryConsole}</Button>
      </CardContent>
    </Card>
  );
}
