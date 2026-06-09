import type { Metadata } from "next";
import { Fragment } from "react";

import { Brand } from "@/components/brand";
import { DocsCodeBlock } from "@/components/docs/docs-code-block";
import { ButtonLink } from "@/components/ui/button";
import { LocaleUtilityMenu } from "@/components/ui/locale-switcher";
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
        <code className="ml-inline-code" key={`${segment}-${index}`}>
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
  const primaryHref = authenticatedAppPath ?? "/auth/sign-up";
  const primaryLabel = authenticatedAppPath
    ? content.ctaSignedIn
    : content.ctaSignedOut;

  return (
    <div className="ml-docs-page">
      <a className="ml-skip-link" href="#docs-main">
        {content.skipToContent}
      </a>

      <aside className="ml-docs-nav">
        <div className="ml-docs-nav__top">
          <Brand meta={content.mastheadMeta} />
        </div>

        <nav aria-label={content.railLabel} className="ml-docs-nav__links">
          <a href="#top">{content.hero.eyebrow}</a>
          {content.sections.map((section, index) => (
            <a href={`#${section.id}`} key={section.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {section.label}
            </a>
          ))}
        </nav>

        <div className="ml-docs-nav__note">
          <strong>{content.railTitle}</strong>
          <ul>
            {content.railNotes.map((note) => (
              <li key={note}>
                <InlineText text={note} />
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="ml-docs-main" id="docs-main">
        <header className="ml-docs-topbar">
          <nav aria-label={t("Primary")} className="ml-docs-topbar__links">
            {marketingPrimaryNav.map((item) => (
              <a
                aria-current={item.href === "/docs" ? "page" : undefined}
                href={item.href}
                key={item.href}
              >
                {t(item.label)}
              </a>
            ))}
          </nav>

          <div className="ml-docs-topbar__actions">
            <LocaleUtilityMenu className="ml-utility-menu" />
            <ThemeUtilityMenu className="ml-utility-menu" />
            <ButtonLink href={primaryHref} size="compact" variant="primary">
              {primaryLabel}
            </ButtonLink>
          </div>
        </header>

        <section className="ml-docs-hero" id="top">
          <p className="ml-eyebrow">{content.hero.eyebrow}</p>
          <h1>
            <InlineText text={content.hero.title} />
          </h1>
          <p>
            <InlineText text={content.hero.intro} />
          </p>
          <div className="ml-action-row">
            <ButtonLink href={primaryHref} variant="primary">
              {primaryLabel}
            </ButtonLink>
          </div>
        </section>

        {content.hero.highlights.length ? (
          <section className="ml-docs-card-grid" aria-label={content.hero.highlightsTitle}>
            {content.hero.highlights.map((item) => (
              <article className="ml-docs-card" key={`${item.label}-${item.value}`}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                {item.detail ? (
                  <p>
                    <InlineText text={item.detail} />
                  </p>
                ) : null}
              </article>
            ))}
          </section>
        ) : null}

        <section className="ml-docs-card ml-docs-notes" aria-label={content.hero.notesTitle}>
          <div>
            <p className="ml-eyebrow">{content.hero.notesTitle}</p>
            <p>
              <InlineText text={content.hero.notesIntro} />
            </p>
          </div>
          <ol>
            {content.hero.notes.map((note) => (
              <li key={`${note.index}-${note.title}`}>
                <span>{note.index}</span>
                <strong>
                  <InlineText text={note.title} />
                </strong>
                <code>
                  <InlineText text={note.meta} />
                </code>
              </li>
            ))}
          </ol>
        </section>

        <div className="ml-docs-content">
          {content.sections.map((section, index) => (
            <section className="ml-docs-section" id={section.id} key={section.id}>
              <header className="ml-docs-section__head">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p className="ml-eyebrow">{section.label}</p>
                <h2>
                  <InlineText text={section.title} />
                </h2>
                <p>
                  <InlineText text={section.intro} />
                </p>
              </header>

              {section.paragraphs?.length ? (
                <div className="ml-docs-prose">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>
                      <InlineText text={paragraph} />
                    </p>
                  ))}
                </div>
              ) : null}

              {section.note ? (
                <aside className="ml-docs-card ml-docs-inline-note">
                  <strong>{section.note.title}</strong>
                  <p>
                    <InlineText text={section.note.body} />
                  </p>
                </aside>
              ) : null}

              {section.valueGroups?.length ? (
                <div className="ml-docs-card-grid">
                  {section.valueGroups.map((group) => (
                    <article className="ml-docs-card" key={group.title}>
                      <h3>{group.title}</h3>
                      <dl className="ml-docs-value-list">
                        {group.items.map((item) => (
                          <div key={`${group.title}-${item.label}`}>
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
                <div className="ml-docs-card-grid">
                  {section.bulletGroups.map((group) => (
                    <article className="ml-docs-card" key={group.title}>
                      <h3>{group.title}</h3>
                      <ul className="ml-docs-list">
                        {group.items.map((item) => (
                          <li key={`${group.title}-${item}`}>
                            <InlineText text={item} />
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              ) : null}

              {section.tables?.length ? (
                <div className="ml-docs-table-stack">
                  {section.tables.map((table) => (
                    <article className="ml-docs-table-card" key={table.title}>
                      <header>
                        <h3>{table.title}</h3>
                        {table.description ? (
                          <p>
                            <InlineText text={table.description} />
                          </p>
                        ) : null}
                      </header>
                      <div className="ml-docs-table-wrap">
                        <table>
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
                    </article>
                  ))}
                </div>
              ) : null}

              {section.codeExamples?.length ? (
                <div className="ml-docs-code-stack">
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

        <footer className="ml-docs-footer">
          <p>
            <InlineText text={content.footerNote} />
          </p>
        </footer>
      </main>
    </div>
  );
}
