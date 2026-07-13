import type { ReactNode } from "react";

import {
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@fugue/ui/components/card";

export function ConsoleCardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      {description ? <CardDescription>{description}</CardDescription> : null}
      {action ? <CardAction>{action}</CardAction> : null}
    </CardHeader>
  );
}
