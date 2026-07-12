import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@fugue/ui/components/badge";
import { Button } from "@fugue/ui/components/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@fugue/ui/components/card";

import { PageHeader } from "@/components/shared/page-header";
import { DocsToc } from "@/components/docs/docs-toc";
import { CopyButton } from "@/components/shared/copy-button";
import { PublicShell } from "@/components/fugue-coss/shells";
import { docsSections } from "@/lib/fugue-coss/docs-sections";
import { getRequestI18n } from "@/lib/i18n/server";
import { createShellMessages } from "@/lib/i18n/ui-messages";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestI18n();
  const title = t("Fugue documentation");
  const description = t(
    "Operate Fugue from source import through runtime inspection, migration, and diagnosis.",
  );

  return {
    title,
    description,
    alternates: { canonical: "/docs" },
    openGraph: { title, description, url: "/docs" },
    twitter: { title, description },
  };
}

export default async function DocsPage() {
  const { t } = await getRequestI18n();
  const tocItems = docsSections.map((section) => ({
    id: section.id,
    label: t(section.title),
  }));

  return (
    <PublicShell messages={createShellMessages(t)}>
      <section className="coss-container coss-page coss-stack">
        <PageHeader
          eyebrow={t("Docs")}
          title={t("Operate Fugue from source import to runtime diagnosis.")}
          description={t(
            "CLI quick start, import modes, topology rules, billing boundaries, migration, failover, inspection, and diagnosis.",
          )}
          action={
            <Button render={<Link href="/new/repository" />}>
              {t("Start deploy")}
            </Button>
          }
        />
        <div className="coss-docs-grid">
          <DocsToc
            items={tocItems}
            label={t("On this page")}
            summary={t("Docs navigation")}
          />
          <div className="coss-stack">
            {docsSections.map((section) => (
              <Card key={section.id}>
                <CardHeader>
                  <CardTitle
                    className="coss-docs-section-title"
                    render={<h2 id={section.id}>{t(section.title)}</h2>}
                  />
                  <CardDescription render={<p />}>{t(section.body)}</CardDescription>
                  <CardAction>
                    <Badge variant="info">CLI</Badge>
                  </CardAction>
                </CardHeader>
                <CardPanel className="coss-stack">
                  <pre className="coss-code" data-slot="code">
                    <code>{section.code}</code>
                  </pre>
                  <div className="coss-row">
                    <CopyButton
                      failureMessage={t("Could not copy to clipboard.")}
                      label={t("Copy command")}
                      successMessage={t("Copied to clipboard.")}
                      value={section.code}
                    />
                    <Button render={<Link href="/app" />} variant="ghost" size="sm">
                      {t("Open console")}
                    </Button>
                  </div>
                </CardPanel>
              </Card>
            ))}
            <Card>
              <CardHeader>
                <CardTitle render={<h2>{t("Billing and continuity boundaries")}</h2>} />
                <CardDescription render={<p />}>
                  {t(
                    "Stateless migrate moves an app service between runtime targets. Managed failover protects backing services that support primary/standby behavior. Both states are visible from the project workbench.",
                  )}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
