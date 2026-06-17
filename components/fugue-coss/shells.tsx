import Link from "next/link";
import type { ReactNode } from "react";
import {
  Boxes,
  CreditCard,
  FileKey2,
  FileText,
  Gauge,
  GitBranch,
  LockKeyhole,
  Network,
  Server,
  Settings,
  Shield,
  Users,
} from "lucide-react";

import {
  Badge,
  ButtonLink,
  Card,
  CardContent,
  CardFrame,
  CardHeader,
  cn,
  PageHeader,
  SkeletonBlock,
} from "@/components/coss/ui";

export function BrandMark() {
  return (
    <Link href="/" className="coss-wordmark" aria-label="Fugue home">
      <span className="coss-wordmark__mark">fg</span>
      <span>Fugue</span>
    </Link>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="coss-root coss-public-shell">
      <header className="coss-site-header">
        <div className="coss-container coss-site-header__inner">
          <BrandMark />
          <nav className="coss-nav" aria-label="Public navigation">
            <Link href="/docs">Docs</Link>
            <Link href="/app">Console</Link>
          </nav>
          <div className="coss-actions">
            <ButtonLink href="/auth/sign-in" variant="ghost">
              Sign in
            </ButtonLink>
            <ButtonLink href="/new/repository">Get started</ButtonLink>
          </div>
        </div>
      </header>
      <main className="coss-main">{children}</main>
    </div>
  );
}

export function AuthShell({
  children,
  title,
  description,
}: {
  children: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="coss-root coss-auth-shell">
      <main className="coss-auth-panel coss-stack">
        <div className="coss-stack-sm" style={{ alignItems: "center" }}>
          <BrandMark />
          <PageHeader title={title} description={description} center />
        </div>
        {children}
      </main>
    </div>
  );
}

export function NewProjectShell({
  children,
  activeStep = "Source",
}: {
  children: ReactNode;
  activeStep?: "Source" | "Configure" | "Deploy";
}) {
  return (
    <PublicShell>
      <section className="coss-container coss-page">
        <div className="coss-stack">
          <div className="coss-stepper" aria-label="Create project steps">
            {["Source", "Configure", "Deploy"].map((step) => (
              <span key={step} data-active={step === activeStep}>
                {step}
              </span>
            ))}
          </div>
          {children}
        </div>
      </section>
    </PublicShell>
  );
}

const workspaceLinks = [
  { href: "/app", label: "Projects", icon: Gauge },
  { href: "/app/cluster-nodes", label: "Servers", icon: Server },
  { href: "/app/api-keys", label: "Access keys", icon: FileKey2 },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
];

const accountLinks = [
  { href: "/app/settings/profile", label: "Profile and security", icon: LockKeyhole },
];

const adminLinks = [
  { href: "/app/apps", label: "Apps", icon: Boxes },
  { href: "/app/users", label: "Users", icon: Users },
  { href: "/app/cluster", label: "Cluster", icon: Network },
];

function SidebarGroup({
  label,
  links,
}: {
  label: string;
  links: Array<{ href: string; label: string; icon: typeof Gauge }>;
}) {
  return (
    <div className="coss-sidebar__section">
      <span className="coss-sidebar__label">{label}</span>
      {links.map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} className="coss-sidebar__link">
            <span className="coss-row">
              <Icon aria-hidden="true" />
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function ConsoleShell({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  return (
    <div className="coss-root coss-console-shell">
      <aside className="coss-sidebar">
        <div className="coss-stack-sm">
          <BrandMark />
          <Card muted>
            <CardContent className="coss-stack-sm">
              <span className="coss-help">Workspace</span>
              <strong>Fugue production</strong>
              <Badge tone="success">Ready</Badge>
            </CardContent>
          </Card>
        </div>
        <SidebarGroup label="Workspace" links={workspaceLinks} />
        <SidebarGroup label="Account" links={accountLinks} />
        <SidebarGroup label="Admin" links={adminLinks} />
      </aside>
      <div className="coss-console-content">
        <details className="coss-mobile-nav">
          <summary>Console navigation</summary>
          <SidebarGroup label="Workspace" links={workspaceLinks} />
          <SidebarGroup label="Account" links={accountLinks} />
          <SidebarGroup label="Admin" links={adminLinks} />
        </details>
        <header className="coss-topbar">
          <div className="coss-row">
            <Badge tone={admin ? "warning" : "info"}>
              {admin ? "Admin surface" : "Workspace console"}
            </Badge>
            <span className="coss-help">Search projects, apps, keys, servers</span>
          </div>
          <div className="coss-actions">
            <ButtonLink href="/docs" variant="outline">
              <FileText aria-hidden="true" />
              Docs
            </ButtonLink>
            <ButtonLink href="/app/settings/profile" variant="secondary">
              <Settings aria-hidden="true" />
              Profile
            </ButtonLink>
          </div>
        </header>
        <main className="coss-console-page">{children}</main>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <ConsoleShell admin>
      <div className="coss-stack">
        <CardFrame>
          <CardContent className="coss-row" style={{ justifyContent: "space-between" }}>
            <div className="coss-row">
              <Shield aria-hidden="true" />
              <div>
                <strong>Administrator controls</strong>
                <p className="coss-card-description">
                  Cluster-wide actions require admin permission and destructive confirmation.
                </p>
              </div>
            </div>
            <Badge tone="warning">High impact</Badge>
          </CardContent>
        </CardFrame>
        {children}
      </div>
    </ConsoleShell>
  );
}

export function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <CardFrame>
      <CardHeader title={title} description={description} action={action} />
      <CardContent>{children}</CardContent>
    </CardFrame>
  );
}

export function LoadingPage({ label = "Loading surface" }: { label?: string }) {
  return (
    <div className="coss-container coss-page coss-stack">
      <PageHeader title={label} description="Preparing a COSS workspace surface." />
      <CardFrame>
        <CardContent className="coss-stack">
          <SkeletonBlock height={34} />
          <SkeletonBlock height={110} />
          <SkeletonBlock height={220} />
        </CardContent>
      </CardFrame>
    </div>
  );
}

export function FeatureList({
  items,
  columns = 3,
}: {
  items: Array<{ title: string; description: string; meta?: string }>;
  columns?: 2 | 3 | 4;
}) {
  return (
    <div className={cn(columns === 2 && "coss-grid-2", columns === 3 && "coss-grid-3", columns === 4 && "coss-grid-4")}>
      {items.map((item) => (
        <Card key={item.title}>
          <CardContent className="coss-stack-sm">
            {item.meta ? <Badge tone="info">{item.meta}</Badge> : null}
            <strong>{item.title}</strong>
            <p className="coss-card-description">{item.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
