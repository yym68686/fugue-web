import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { ensureAppUserRecord } from "@/lib/app-users/store";
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

  try {
    const user = await ensureAppUserRecord(session);
    return (
      <ConsoleShell isAdmin={user.isAdmin} session={session}>
        {children}
      </ConsoleShell>
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("blocked")) {
      redirect("/auth/sign-in?error=account-blocked");
    }

    if (error instanceof Error && error.message.includes("deleted")) {
      redirect("/auth/sign-in?error=account-deleted");
    }

    throw error;
  }
}
