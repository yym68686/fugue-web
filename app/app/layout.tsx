import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { ConsoleShell } from "@/components/console/console-shell";
import { getCurrentSession } from "@/lib/auth/session";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth/sign-in?error=auth-required");
  }

  return <ConsoleShell session={session}>{children}</ConsoleShell>;
}
