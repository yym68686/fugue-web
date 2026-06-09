import type { ReactNode } from "react";

import { Brand } from "@/components/brand";
import { LocaleMenuButton } from "@/components/ui/locale-switcher";
import { ThemeMenuButton } from "@/components/ui/theme-switcher";

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

export function AuthShell({
  brandMeta,
  children,
  description,
  eyebrow,
  footer,
  notes,
  title,
}: AuthShellProps) {
  const resolvedBrandMeta =
    brandMeta ??
    (eyebrow.startsWith("Auth / ") ? eyebrow.slice("Auth / ".length) : eyebrow);

  return (
    <main className="auth-shell ml-auth-shell">
      <section className="auth-panel ml-auth-panel" aria-labelledby="auth-title">
        <div className="auth-topline ml-auth-topline">
          <Brand meta={resolvedBrandMeta} />
          <div className="ml-auth-utilities">
            <LocaleMenuButton />
            <ThemeMenuButton />
          </div>
        </div>

        <header className="page-header ml-auth-header">
          <p className="ml-eyebrow">{eyebrow}</p>
          <h1 id="auth-title">{title}</h1>
          <p>{description}</p>
        </header>

        <div className="ml-auth-body">{children}</div>

        <ol className="ml-auth-notes" aria-label={eyebrow}>
          {notes.map((note) => (
            <li key={`${note.index}-${note.title}`}>
              <span>{note.index}</span>
              <strong>{note.title}</strong>
              <code>{note.meta}</code>
            </li>
          ))}
        </ol>

        <footer className="ml-auth-footer">{footer}</footer>
      </section>
    </main>
  );
}
