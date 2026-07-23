import { cookies } from "next/headers";

import AppShell, { type AppShellUser } from "@/components/layout/AppShell";
import { getRequestActiveSessionUser } from "@/lib/server/request-context";
import { getRequestI18n } from "@/lib/i18n/server";
import {
  LOCALE_COOKIE_NAME,
  parseLocalePreference,
} from "@/lib/i18n/core";
import { THEME_COOKIE_NAME, parseThemePreference } from "@/lib/theme";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [active, i18n, cookieStore] = await Promise.all([
    getRequestActiveSessionUser(),
    getRequestI18n(),
    cookies(),
  ]);

  const record = active?.user;
  const session = active?.session;
  const user: AppShellUser = {
    name: record?.name ?? session?.name ?? null,
    email: record?.email ?? session?.email ?? "",
    pictureUrl: record?.pictureUrl ?? session?.picture ?? null,
    isAdmin: Boolean(record?.isAdmin),
  };

  const themePreference = parseThemePreference(
    cookieStore.get(THEME_COOKIE_NAME)?.value,
  );
  const localePreference = parseLocalePreference(
    cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  );

  return (
    <AppShell
      user={user}
      locale={i18n.locale}
      themePreference={themePreference}
      localePreference={localePreference}
    >
      {children}
    </AppShell>
  );
}
