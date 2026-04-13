import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";

import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { ConsoleShell } from "@/components/console/console-shell";
import { ToastProvider } from "@/components/ui/toast";
import type { SessionUser } from "@/lib/auth/session";
import {
  ensureRequestAppUserRecord,
  getRequestSession,
  getRequestWorkspaceAccess,
} from "@/lib/server/request-context";

import "../console.css";

async function ResolvedConsoleShell({
  children,
  session,
}: {
  children: ReactNode;
  session: SessionUser;
}) {
  try {
    const [user, workspace] = await Promise.all([
      ensureRequestAppUserRecord(),
      getRequestWorkspaceAccess(),
    ]);

    if (!user) {
      redirect("/auth/sign-in?error=auth-required");
    }

    const hasProjects = Boolean(
      workspace?.firstAppId ?? workspace?.defaultProjectId,
    );

    return (
      <ConsoleShell
        hasProjects={hasProjects}
        isAdmin={user.isAdmin}
        session={session}
      >
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

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getRequestSession();

  if (!session) {
    redirect("/auth/sign-in?error=auth-required");
  }

  return (
    <ToastProvider>
      <ConfirmDialogProvider>
        <Suspense
          fallback={
            <ConsoleShell
              hasProjects={false}
              isAdmin={false}
              session={session}
            >
              {children}
            </ConsoleShell>
          }
        >
          <ResolvedConsoleShell session={session}>
            {children}
          </ResolvedConsoleShell>
        </Suspense>
      </ConfirmDialogProvider>
    </ToastProvider>
  );
}
