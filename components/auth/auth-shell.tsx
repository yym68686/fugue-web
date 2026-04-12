import type { ReactNode } from "react";

import { Brand } from "@/components/brand";
import { LocaleMenuButton } from "@/components/ui/locale-switcher";
import { RouteNote } from "@/components/ui/route-note";
import { getRequestI18n } from "@/lib/i18n/server";

type AuthRouteNote = {
  index: string;
  title: string;
  meta: string;
};

type AuthShellProps = {
  brandMeta?: string;
  children: ReactNode;
  description: string;
  eyebrow: string;
  footer: ReactNode;
  notes: AuthRouteNote[];
  title: string;
};

export async function AuthShell({
  brandMeta,
  children,
  description,
  eyebrow,
  footer,
  notes,
  title,
}: AuthShellProps) {
  const { t } = await getRequestI18n();
  const resolvedBrandMeta = brandMeta ?? (eyebrow.startsWith("Auth / ") ? eyebrow.slice("Auth / ".length) : eyebrow);

  return (
    <main className="fg-auth-page fg-auth-page--account">
      <div className="fg-auth-grid">
        <section className="fg-auth-stage">
          <div className="fg-auth-stage__top fg-auth-stage__topbar">
            <Brand meta={resolvedBrandMeta} />
            <LocaleMenuButton />
          </div>

          <div className="fg-auth-stage__copy">
            <p className="fg-label">{eyebrow}</p>
            <h1 className="fg-display-heading">{title}</h1>
            <p className="fg-copy">{description}</p>
          </div>

          <svg className="fg-route-signal fg-auth-stage__signal" viewBox="0 0 1200 170" aria-hidden="true">
            <path className="fg-route-signal__base" d="M40 118 C232 26, 372 32, 538 96 S860 180, 1160 36" />
            <path className="fg-route-signal__active" d="M40 118 C232 26, 372 32, 538 96 S860 180, 1160 36" />
            <circle className="fg-route-signal__dot" cx="40" cy="118" r="7" />
            <circle className="fg-route-signal__dot" cx="538" cy="96" r="7" />
            <circle className="fg-route-signal__dot" cx="1160" cy="36" r="7" />
          </svg>

          <div className="fg-auth-stage__notes">
            {notes.map((note) => (
              <RouteNote
                index={note.index}
                key={`${note.index}-${note.title}`}
                meta={note.meta}
                title={note.title}
              />
            ))}
          </div>

          <div className="fg-object-belt" aria-label={t("Core objects")}>
            <span>{t("Workspace")}</span>
            <span>{t("Project")}</span>
            <span>{t("App")}</span>
            <span>{t("Runtime")}</span>
            <span>{t("Operation")}</span>
          </div>

          <div className="fg-auth-stage__footer">{footer}</div>
        </section>

        <section className="fg-auth-panel-slot">{children}</section>
      </div>
    </main>
  );
}
