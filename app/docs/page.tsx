import { BookOpen } from "lucide-react";

import {
  Badge,
  ButtonLink,
  Card,
  CardContent,
  CardFrame,
  CardHeader,
  CodeBlock,
  PageHeader,
} from "@/components/coss/ui";
import { CopyButton } from "@/components/fugue-coss/interactive";
import { PublicShell } from "@/components/fugue-coss/shells";
import { docsSections } from "@/lib/fugue-coss/demo-data";

export default function DocsPage() {
  return (
    <PublicShell>
      <section className="coss-container coss-page coss-stack">
        <PageHeader
          eyebrow="Docs"
          title="Operate Fugue from source import to runtime diagnosis."
          description="A compact COSS docs shell with CLI quick start, import modes, topology rules, billing boundaries, migration, failover, inspect, and diagnose."
          action={<ButtonLink href="/new/repository">Start deploy</ButtonLink>}
        />
        <details className="coss-mobile-nav">
          <summary>Docs navigation</summary>
          <div className="coss-stack-sm">
            {docsSections.map((section) => (
              <a key={section.id} className="coss-sidebar__link" href={`#${section.id}`}>
                {section.title}
              </a>
            ))}
          </div>
        </details>
        <div className="coss-docs-grid">
          <CardFrame className="coss-stack-sm">
            <CardHeader title="Contents" description="Jump to the task you need." />
            <CardContent className="coss-stack-sm">
              {docsSections.map((section) => (
                <a key={section.id} className="coss-sidebar__link" href={`#${section.id}`}>
                  <span className="coss-row">
                    <BookOpen aria-hidden="true" />
                    {section.title}
                  </span>
                </a>
              ))}
            </CardContent>
          </CardFrame>
          <div className="coss-stack">
            {docsSections.map((section) => (
              <CardFrame key={section.id}>
                <CardHeader
                  title={<span id={section.id}>{section.title}</span>}
                  description={section.body}
                  action={<Badge tone="info">CLI</Badge>}
                />
                <CardContent className="coss-stack">
                  <CodeBlock>{section.code}</CodeBlock>
                  <div className="coss-row">
                    <CopyButton value={section.code} label="Copy command" />
                    <ButtonLink href="/app" variant="ghost" size="sm">
                      Open console
                    </ButtonLink>
                  </div>
                </CardContent>
              </CardFrame>
            ))}
            <Card>
              <CardContent className="coss-stack-sm">
                <strong>Billing and continuity boundaries</strong>
                <p className="coss-card-description">
                  Stateless migrate moves an app service between runtime targets. Managed failover protects backing services that support primary/standby behavior. Both states are visible from the project workbench.
                </p>
              </CardContent>
            </Card>
          </div>
          <CardFrame>
            <CardHeader title="On this page" description="Right-side outline for desktop reading." />
            <CardContent className="coss-stack-sm">
              {docsSections.map((section) => (
                <a key={section.id} className="coss-sidebar__link" href={`#${section.id}`}>{section.title}</a>
              ))}
              <Badge tone="info">Language fallback: default content</Badge>
            </CardContent>
          </CardFrame>
        </div>
      </section>
    </PublicShell>
  );
}
