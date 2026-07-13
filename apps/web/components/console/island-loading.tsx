"use client";

import { Card, CardContent } from "@fugue/ui/components/card";
import { Skeleton } from "@fugue/ui/components/skeleton";
import { useClientUiMessages } from "@/components/i18n/locale-select";

export function ConsoleIslandLoading() {
  const messages = useClientUiMessages();

  return (
    <Card
      aria-busy="true"
      aria-label={messages.loadingConsoleData}
      aria-live="polite"
      role="status"
    >
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-8 w-2/5" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-52 w-full" />
      </CardContent>
    </Card>
  );
}
