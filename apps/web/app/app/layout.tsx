import { ToastProvider } from "@fugue/ui/components/toast";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ConsoleBaseUIEnvironment } from "@/components/console/base-ui-environment";
import { ConsoleShell } from "@/components/fugue-coss/shells";

import { requireActivePageSession } from "@/lib/auth/page-access";
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
  const activeSession = await requireActivePageSession();
  const { locale, localePreference, t } = await getRequestI18n();
  const { dir } = getDocumentLocaleAttributes(locale, localePreference);

  return (
    <ConsoleBaseUIEnvironment direction={dir}>
      <ToastProvider>
        <ConsoleShell
          isAdmin={activeSession.user.isAdmin}
          messages={createShellMessages(t)}
        >
          {children}
        </ConsoleShell>
      </ToastProvider>
    </ConsoleBaseUIEnvironment>
  );
}
