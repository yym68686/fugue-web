import type { Metadata } from "next";
import { Fragment } from "react";

import { Brand } from "@/components/brand";
import {
  DocsSectionNav,
  type DocsSectionNavItem,
} from "@/components/docs/docs-section-nav";
import { DocsCodeBlock } from "@/components/docs/docs-code-block";
import { ButtonLink } from "@/components/ui/button";
import { LocaleUtilityMenu } from "@/components/ui/locale-switcher";
import { PillNav, PillNavAnchor } from "@/components/ui/pill-nav";
import { ProofShell, ProofShellRibbon } from "@/components/ui/proof-shell";
import { RouteNote } from "@/components/ui/route-note";
import { ThemeUtilityMenu } from "@/components/ui/theme-switcher";
import { readAuthenticatedAppPath } from "@/lib/auth/handoff";
import { readDocsContent } from "@/lib/docs/content";
import { getRequestI18n } from "@/lib/i18n/server";
import { marketingPrimaryNav } from "@/lib/site/navigation";

import "./docs.css";

function renderInlineText(text: string) {
  return text.split(/(`[^`]+`)/g).map((segment, index) => {
    if (!segment) {
      return null;
    }

    if (segment.startsWith("`") && segment.endsWith("`")) {
      return (
        <code className="fg-docs-inline-code" key={`${segment}-${index}`}>
          {segment.slice(1, -1)}
        </code>
      );
    }

    return <Fragment key={`${segment}-${index}`}>{segment}</Fragment>;
  });
}

function InlineText({ text }: { text: string }) {
  return <>{renderInlineText(text)}</>;
}

function RouteSignalGraphic() {
  return (
    <svg
      aria-hidden="true"
      className="fg-route-signal fg-docs-stage__signal"
      viewBox="0 0 1200 170"
    >
      <path
        className="fg-route-signal__base"
        d="M40 118 C232 26, 372 32, 538 96 S860 180, 1160 36"
      />
      <path
        className="fg-route-signal__active"
        d="M40 118 C232 26, 372 32, 538 96 S860 180, 1160 36"
      />
      <circle className="fg-route-signal__dot" cx="40" cy="118" r="7" />
      <circle className="fg-route-signal__dot" cx="538" cy="96" r="7" />
      <circle className="fg-route-signal__dot" cx="1160" cy="36" r="7" />
    </svg>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestI18n();
  const content = readDocsContent(locale);

  return {
    title: content.metadata.title,
    description: content.metadata.description,
  };
}

export default async function DocsPage() {
  const [{ locale, t }, authenticatedAppPath] = await Promise.all([
    getRequestI18n(),
    readAuthenticatedAppPath(),
  ]);
  const content = readDocsContent(locale);
  const isCjkLocale = locale.startsWith("zh");
  const primaryHref = authenticatedAppPath ?? "/auth/sign-up";
  const primaryLabel = authenticatedAppPath
    ? content.ctaSignedIn
    : content.ctaSignedOut;
  const sectionNavItems: DocsSectionNavItem[] = content.sections.map(
    (section, index) => ({
      id: section.id,
      index: String(index + 1).padStart(2, "0"),
      label: section.label,
      title: section.title,
    }),
  );

  return (
    <div className="fg-docs-page fg-atmosphere">
      <a className="fg-docs-skip-link" href="#docs-main">
        {content.skipToContent}
      </a>

      <header className="fg-docs-masthead">
        <div className="fg-shell fg-docs-masthead__shell">
          <Brand meta={content.mastheadMeta} />

          <PillNav ariaLabel={t("Primary")} className="fg-docs-nav">
            {marketingPrimaryNav.map((item) => (
              <PillNavAnchor
                active={item.href === "/docs"}
                href={item.href}
                key={item.href}
              >
                {t(item.label)}
              </PillNavAnchor>
            ))}
          </PillNav>

          <div className="fg-docs-masthead__actions">
            <ThemeUtilityMenu className="fg-docs-theme-switcher" />
            <LocaleUtilityMenu className="fg-docs-locale-switcher" />
            <ButtonLink
              className="fg-docs-topbar-action"
              href={primaryHref}
              size="compact"
              variant="route"
            >
              {primaryLabel}
            </ButtonLink>
          </div>
        </div>
      </header>

      <main className="fg-shell fg-docs-main" id="docs-main">
        <section className="fg-docs-stage" id="top">
          <div
            className={
              isCjkLocale
                ? "fg-docs-stage__copy is-cjk"
                : "fg-docs-stage__copy"
            }
          >
            <p className="fg-label">{content.hero.eyebrow}</p>
            <h1 className="fg-ui-heading fg-docs-stage__title">
              <InlineText text={content.hero.title} />
            </h1>
            <p className="fg-copy fg-docs-stage__intro">
              <InlineText text={content.hero.intro} />
            </p>

            <div className="fg-docs-stage__actions">
              <ButtonLink href={primaryHref} variant="route">
                {primaryLabel}
              </ButtonLink>
            </div>

            <div className="fg-object-belt fg-docs-topic-belt" aria-label={content.railLabel}>
              {content.sections.map((section) => (
                <span key={section.id}>{section.label}</span>
              ))}
            </div>

            <p className="fg-docs-stage__footnote">
              <InlineText text={content.footerNote} />
            </p>
          </div>

          <div className="fg-docs-stage__aside">
            <div className="fg-docs-stage__diagram">
              <p className="fg-label fg-docs-stage__kicker">
                {content.hero.notesTitle}
              </p>
              <div className="fg-docs-stage__signal-wrap">
                <RouteSignalGraphic />
                <span aria-hidden="true" className="fg-docs-stage__ghost">
                  Route
                </span>
              </div>
            </div>

            <ProofShell className="fg-docs-stage__notes-shell">
              <ProofShellRibbon>
                <span>{content.hero.notesTitle}</span>
              </ProofShellRibbon>

              <div className="fg-docs-stage__notes-body">
                <p className="fg-docs-stage__notes-intro">
                  <InlineText text={content.hero.notesIntro} />
                </p>

                <div className="fg-docs-route-note-grid">
                  {content.hero.notes.map((note) => (
                    <RouteNote
                      index={note.index}
                      key={`${note.index}-${note.title}`}
                      meta={<InlineText text={note.meta} />}
                      title={<InlineText text={note.title} />}
                    />
                  ))}
                </div>
              </div>
            </ProofShell>
          </div>
        </section>

        {content.hero.highlights.length ? (
          <section className="fg-docs-overview" aria-label={content.hero.notesTitle}>
            <div className="fg-docs-highlight-grid">
              {content.hero.highlights.map((item, itemIndex) => (
                <article
                  className="fg-docs-highlight-card"
                  key={`${item.label}-${itemIndex}`}
                >
                  <span className="fg-docs-highlight-card__label">
                    <InlineText text={item.label} />
                  </span>
                  <strong className="fg-docs-highlight-card__value">
                    <InlineText text={item.value} />
                  </strong>
                  {item.detail ? (
                    <p className="fg-docs-highlight-card__detail">
                      <InlineText text={item.detail} />
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <DocsSectionNav
          ariaLabel={content.railLabel}
          className="fg-docs-section-strip"
          sections={sectionNavItems}
          variant="pill"
        />

        <div className="fg-docs-layout">
          <aside className="fg-docs-rail">
            <ProofShell className="fg-docs-rail-shell">
              <ProofShellRibbon>
                <span>{content.railLabel}</span>
              </ProofShellRibbon>

              <div className="fg-docs-rail-shell__body">
                <DocsSectionNav
                  ariaLabel={content.railLabel}
                  sections={sectionNavItems}
                  variant="rail"
                />
              </div>
            </ProofShell>

            <ProofShell className="fg-docs-rail-note-shell">
              <ProofShellRibbon>
                <span>{content.railTitle}</span>
              </ProofShellRibbon>

              <div className="fg-docs-rail-notes">
                <ul className="fg-docs-rail-note-list">
                  {content.railNotes.map((note, noteIndex) => (
                    <li key={`${noteIndex}-${note}`}>
                      <InlineText text={note} />
                    </li>
                  ))}
                </ul>
              </div>
            </ProofShell>
          </aside>

          <div className="fg-docs-content">
            {content.sections.map((section, index) => (
              <section className="fg-docs-section" id={section.id} key={section.id}>
                <div className="fg-docs-section__head">
                  <div className="fg-docs-section__eyebrow">
                    <span className="fg-docs-section__index">
                      {sectionNavItems[index]?.index}
                    </span>
                    <p className="fg-label">{section.label}</p>
                  </div>

                  <h2 className="fg-ui-heading fg-docs-section__title">
                    <InlineText text={section.title} />
                  </h2>

                  <p className="fg-copy fg-docs-section__intro">
                    <InlineText text={section.intro} />
                  </p>

                  {section.paragraphs?.length ? (
                    <div className="fg-docs-prose">
                      {section.paragraphs.map((paragraph) => (
                        <p key={paragraph}>
                          <InlineText text={paragraph} />
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>

                {section.note ? (
                  <ProofShell className="fg-docs-note-shell">
                    <ProofShellRibbon>
                      <span>{section.note.title}</span>
                    </ProofShellRibbon>

                    <div className="fg-docs-note-card">
                      <p>
                        <InlineText text={section.note.body} />
                      </p>
                    </div>
                  </ProofShell>
                ) : null}

                {section.valueGroups?.length ? (
                  <div className="fg-docs-value-groups">
                    {section.valueGroups.map((group, groupIndex) => (
                      <article
                        className="fg-docs-value-group"
                        key={`${group.title}-${groupIndex}`}
                      >
                        <h3 className="fg-docs-card-title">{group.title}</h3>

                        <dl className="fg-docs-value-list">
                          {group.items.map((item, itemIndex) => (
                            <div
                              className="fg-docs-value-item"
                              key={`${group.title}-${item.label}-${itemIndex}`}
                            >
                              <dt>
                                <InlineText text={item.label} />
                              </dt>
                              <dd>
                                <strong>
                                  <InlineText text={item.value} />
                                </strong>
                                {item.detail ? (
                                  <span>
                                    <InlineText text={item.detail} />
                                  </span>
                                ) : null}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </article>
                    ))}
                  </div>
                ) : null}

                {section.bulletGroups?.length ? (
                  <div className="fg-docs-bullet-groups">
                    {section.bulletGroups.map((group, groupIndex) => (
                      <article
                        className="fg-docs-bullet-group"
                        key={`${group.title}-${groupIndex}`}
                      >
                        <h3 className="fg-docs-card-title">{group.title}</h3>

                        <ul>
                          {group.items.map((item, itemIndex) => (
                            <li key={`${group.title}-${itemIndex}`}>
                              <InlineText text={item} />
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                ) : null}

                {section.tables?.length ? (
                  <div className="fg-docs-table-stack">
                    {section.tables.map((table, tableIndex) => (
                      <ProofShell
                        className="fg-docs-table-shell"
                        key={`${table.title}-${tableIndex}`}
                      >
                        <ProofShellRibbon>
                          <div className="fg-docs-table-head">
                            <strong>{table.title}</strong>
                            {table.description ? (
                              <p>
                                <InlineText text={table.description} />
                              </p>
                            ) : null}
                          </div>
                        </ProofShellRibbon>

                        <div className="fg-docs-table-wrap">
                          <table className="fg-docs-table">
                            <thead>
                              <tr>
                                {table.columns.map((column) => (
                                  <th key={column} scope="col">
                                    {column}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {table.rows.map((row, rowIndex) => (
                                <tr key={`${table.title}-row-${rowIndex}`}>
                                  {row.map((cell, cellIndex) => (
                                    <td key={`${table.title}-${rowIndex}-${cellIndex}`}>
                                      <InlineText text={cell} />
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </ProofShell>
                    ))}
                  </div>
                ) : null}

                {section.codeExamples?.length ? (
                  <div className="fg-docs-code-stack">
                    {section.codeExamples.map((example) => (
                      <DocsCodeBlock
                        caption={example.caption}
                        code={example.code}
                        copiedLabel={content.copiedLabel}
                        copyLabel={content.copyLabel}
                        filename={example.filename}
                        key={`${section.id}-${example.title}`}
                        language={example.language}
                        title={example.title}
                      />
                    ))}
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        </div>

        <footer className="fg-docs-footer">
          <div className="fg-object-belt fg-docs-footer__belt" aria-label={content.railLabel}>
            {content.sections.map((section) => (
              <span key={`footer-${section.id}`}>{section.label}</span>
            ))}
          </div>
        </footer>
      </main>
    </div>
  );
}
