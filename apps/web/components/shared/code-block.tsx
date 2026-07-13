import type { ReactNode } from "react";

export function CodeBlock({ children }: { children: ReactNode }) {
  return (
    <pre className="coss-code" data-slot="code">
      <code>{children}</code>
    </pre>
  );
}
