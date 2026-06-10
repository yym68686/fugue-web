import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { ConsoleShell } from "@/components/console/console-shell";
import { ToastProvider } from "@/components/ui/toast";
import {
  getRequestAppUserRecord,
  getRequestSession,
} from "@/lib/server/request-context";

import "../console.css";
import "../console-components.css";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getRequestSession();

  if (!session) {
    redirect("/auth/sign-in?error=auth-required");
  }

  let user: Awaited<ReturnType<typeof getRequestAppUserRecord>>;

  try {
    user = await getRequestAppUserRecord();
  } catch (error) {
    if (error instanceof Error && error.message.includes("blocked")) {
      redirect("/auth/sign-in?error=account-blocked");
    }

    if (error instanceof Error && error.message.includes("deleted")) {
      redirect("/auth/sign-in?error=account-deleted");
    }

    throw error;
  }

  return (
    <ToastProvider>
      <ConfirmDialogProvider>
        <ConsoleShell
          hasProjects={Boolean(user)}
          isAdmin={user?.isAdmin ?? false}
          session={session}
        >
          {children}
        </ConsoleShell>
      </ConfirmDialogProvider>
    </ToastProvider>
  );
}
