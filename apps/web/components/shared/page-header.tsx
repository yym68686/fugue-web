import type { ReactNode } from "react";

import { cn } from "@fugue/ui/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  center = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  center?: boolean;
}) {
  return (
    <header
      className={cn("coss-page-header", center && "coss-page-header--center")}
      data-slot="page-header"
    >
      {eyebrow ? <span className="coss-eyebrow">{eyebrow}</span> : null}
      <div className="coss-row coss-row--between">
        <div className="coss-stack-sm">
          <h1 className="coss-page-title">{title}</h1>
          {description ? <p className="coss-page-description">{description}</p> : null}
        </div>
        {action}
      </div>
    </header>
  );
}
