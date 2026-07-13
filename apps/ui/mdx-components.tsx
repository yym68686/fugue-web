import type { MDXComponents } from "mdx/types";

import { Alert, AlertDescription, AlertTitle } from "@/registry/default/ui/alert";
import { cn } from "@/registry/default/lib/utils";

export const mdxComponents: MDXComponents = {
  h1: ({ className, ...props }) => (
    <h1 className={cn("scroll-m-20 text-3xl font-semibold", className)} {...props} />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn(
        "mt-12 scroll-m-20 border-b pb-2 text-2xl font-semibold",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cn("mt-8 scroll-m-20 text-xl font-semibold", className)}
      {...props}
    />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn("font-medium text-primary underline underline-offset-4", className)}
      {...props}
    />
  ),
  code: ({ className, ...props }) => (
    <code
      className={cn("rounded-md bg-code px-1.5 py-0.5 text-sm", className)}
      {...props}
    />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn("my-5 overflow-x-auto rounded-xl border bg-code p-4", className)}
      {...props}
    />
  ),
  Note: ({
    title = "Note",
    children,
  }: {
    title?: string;
    children: React.ReactNode;
  }) => (
    <Alert className="my-6" variant="info">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  ),
};
