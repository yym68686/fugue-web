import { ToastProvider } from "@fugue/ui/components/toast";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ConsoleBaseUIEnvironment } from "@/components/console/base-ui-environment";
import { ConsoleShell } from "@/components/fugue-coss/shells";

import {
  getCurrentActiveSessionUser,
  SessionAuthorizationError,
} from "@/lib/auth/session";
import { getDocumentLocaleAttributes } from "@/lib/i18n/core";
import { getRequestI18n } from "@/lib/i18n/server";
import { createShellMessages } from "@/lib/i18n/ui-messages";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
    noarchive: true,
    nocache: true,
  },
};

export default async function AppLayout({ children }: { children: ReactNode }) {
  let isAdmin = false;
  const { locale, localePreference, t } = await getRequestI18n();
  const { dir } = getDocumentLocaleAttributes(locale, localePreference);

  try {
    const activeSession = await getCurrentActiveSessionUser();

    if (!activeSession) {
      redirect("/auth/sign-in?returnTo=%2Fapp");
    }

    isAdmin = activeSession.user.isAdmin;
  } catch (error) {
    if (error instanceof SessionAuthorizationError) {
      const reason =
        error.reason === "blocked"
          ? "account-blocked"
          : error.reason === "deleted"
            ? "account-deleted"
            : "session-expired";
      redirect(`/auth/sign-in?error=${reason}&returnTo=%2Fapp`);
    }

    throw error;
  }

  return (
    <ConsoleBaseUIEnvironment direction={dir}>
      <ToastProvider>
        <ConsoleShell isAdmin={isAdmin} messages={createShellMessages(t)}>
          {children}
        </ConsoleShell>
      </ToastProvider>
    </ConsoleBaseUIEnvironment>
  );
}
