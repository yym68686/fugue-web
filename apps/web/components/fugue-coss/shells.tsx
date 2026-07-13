import { Badge } from "@fugue/ui/components/badge";
import { Button } from "@fugue/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFrame,
  CardHeader,
  CardTitle,
} from "@fugue/ui/components/card";
import { Skeleton } from "@fugue/ui/components/skeleton";
import { cn } from "@fugue/ui/lib/utils";
import {
  Boxes,
  CreditCard,
  FileKey2,
  FileText,
  Gauge,
  Globe2,
  LockKeyhole,
  Network,
  Server,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  type ConsoleBreadcrumbMessages,
  ConsoleBreadcrumbs,
  ConsoleRouteLink,
} from "@/components/console/console-navigation";
import { LocaleSelect } from "@/components/i18n/locale-select";
import { PageHeader } from "@/components/shared/page-header";
import type { ShellMessages } from "@/lib/i18n/ui-messages";

export function BrandMark({ messages }: { messages: ShellMessages }) {
  return (
    <Link href="/" className="coss-wordmark" aria-label={messages.fugueHome}>
      <span className="coss-wordmark__mark">fg</span>
      <span>Fugue</span>
    </Link>
  );
}

export function PublicShell({
  children,
  messages,
}: {
  children: ReactNode;
  messages: ShellMessages;
}) {
  return (
    <div className="coss-root coss-public-shell">
      <a className="coss-skip-link" href="#main-content">
        {messages.skipToMain}
      </a>
      <header className="coss-site-header">
        <div className="coss-container coss-site-header__inner">
          <BrandMark messages={messages} />
          <nav className="coss-nav" aria-label={messages.publicNavigation}>
            <Link href="/docs">{messages.docs}</Link>
            <Link href="/app">{messages.console}</Link>
          </nav>
          <div className="coss-actions">
            <LocaleSelect />
            <Button render={<Link href="/auth/sign-in" />} variant="ghost">
              {messages.signIn}
            </Button>
            <Button render={<Link href="/new/repository" />}>
              {messages.getStarted}
            </Button>
          </div>
        </div>
      </header>
      <main className="coss-main" id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

export function AuthShell({
  children,
  title,
  description,
  messages,
}: {
  children: ReactNode;
  title: string;
  description: string;
  messages: ShellMessages;
}) {
  return (
    <div className="coss-root coss-auth-shell">
      <a className="coss-skip-link" href="#main-content">
        {messages.skipToMain}
      </a>
      <main className="coss-auth-panel coss-stack" id="main-content" tabIndex={-1}>
        <div className="coss-auth-toolbar">
          <LocaleSelect />
        </div>
        <div className="coss-stack-sm coss-stack--center">
          <BrandMark messages={messages} />
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
  messages,
}: {
  children: ReactNode;
  activeStep?: "Source" | "Configure" | "Deploy";
  messages: ShellMessages;
}) {
  const stepLabels = {
    Configure: messages.configure,
    Deploy: messages.deploy,
    Source: messages.source,
  } as const;

  return (
    <PublicShell messages={messages}>
      <section className="coss-container coss-page">
        <div className="coss-stack">
          <ol className="coss-stepper" aria-label={messages.createProjectSteps}>
            {["Source", "Configure", "Deploy"].map((step) => (
              <li key={step} data-active={step === activeStep}>
                {stepLabels[step as keyof typeof stepLabels]}
              </li>
            ))}
          </ol>
          {children}
        </div>
      </section>
    </PublicShell>
  );
}

type NavigationItem = {
  href: string;
  icon: typeof Gauge;
  label: string;
  matchPrefixes?: string[];
};

function navigationItems(messages: ShellMessages) {
  return {
    account: [
      {
        href: "/app/settings/profile",
        label: messages.profileAndSecurity,
        icon: LockKeyhole,
      },
    ] satisfies NavigationItem[],
    admin: [
      { href: "/app/apps", label: messages.apps, icon: Boxes },
      { href: "/app/users", label: messages.users, icon: Users },
      { href: "/app/cluster", label: messages.cluster, icon: Network },
    ] satisfies NavigationItem[],
    workspace: [
      {
        href: "/app",
        label: messages.projects,
        icon: Gauge,
        matchPrefixes: ["/app/projects/"],
      },
      { href: "/app/cluster-nodes", label: messages.servers, icon: Server },
      { href: "/app/dns", label: messages.dns, icon: Globe2 },
      { href: "/app/api-keys", label: messages.accessKeys, icon: FileKey2 },
      { href: "/app/billing", label: messages.billing, icon: CreditCard },
    ] satisfies NavigationItem[],
  };
}

function SidebarGroup({ label, links }: { label: string; links: NavigationItem[] }) {
  return (
    <div className="coss-sidebar__section">
      <span className="coss-sidebar__label">{label}</span>
      {links.map((item) => {
        const Icon = item.icon;

        return (
          <ConsoleRouteLink
            href={item.href}
            key={item.href}
            matchPrefixes={item.matchPrefixes}
          >
            <span className="coss-row">
              <Icon aria-hidden="true" />
              {item.label}
            </span>
          </ConsoleRouteLink>
        );
      })}
    </div>
  );
}

function ConsoleSidebarNavigation({
  isAdmin,
  messages,
}: {
  isAdmin: boolean;
  messages: ShellMessages;
}) {
  const links = navigationItems(messages);

  return (
    <nav aria-label={messages.consoleNavigation}>
      <SidebarGroup label={messages.workspace} links={links.workspace} />
      <SidebarGroup label={messages.account} links={links.account} />
      {isAdmin ? <SidebarGroup label={messages.admin} links={links.admin} /> : null}
    </nav>
  );
}

function consoleBreadcrumbMessages(
  messages: ShellMessages,
  isAdmin: boolean,
): ConsoleBreadcrumbMessages {
  return {
    accessKeys: messages.accessKeys,
    account: messages.account,
    billing: messages.billing,
    breadcrumb: messages.breadcrumb,
    console: messages.console,
    dns: messages.dns,
    profileAndSecurity: messages.profileAndSecurity,
    projects: messages.projects,
    servers: messages.servers,
    workspace: messages.workspace,
    ...(isAdmin
      ? {
          admin: messages.admin,
          apps: messages.apps,
          cluster: messages.cluster,
          users: messages.users,
        }
      : {}),
  };
}

export function ConsoleShell({
  children,
  isAdmin,
  messages,
}: {
  children: ReactNode;
  isAdmin: boolean;
  messages: ShellMessages;
}) {
  return (
    <div className="coss-root coss-console-shell">
      <a className="coss-skip-link" href="#main-content">
        {messages.skipToMain}
      </a>
      <aside className="coss-sidebar">
        <BrandMark messages={messages} />
        <ConsoleSidebarNavigation isAdmin={isAdmin} messages={messages} />
      </aside>
      <div className="coss-console-content">
        <details className="coss-mobile-nav">
          <summary>{messages.consoleNavigation}</summary>
          <ConsoleSidebarNavigation isAdmin={isAdmin} messages={messages} />
        </details>
        <header className="coss-topbar">
          <ConsoleBreadcrumbs messages={consoleBreadcrumbMessages(messages, isAdmin)} />
          <div className="coss-actions">
            <LocaleSelect />
            <Button render={<Link href="/docs" />} variant="outline">
              <FileText aria-hidden="true" />
              {messages.docs}
            </Button>
            <Button render={<Link href="/app/settings/profile" />} variant="secondary">
              <Settings aria-hidden="true" />
              {messages.profile}
            </Button>
          </div>
        </header>
        <main className="coss-console-page" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
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
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </CardFrame>
  );
}

export function LoadingPage({
  description,
  label,
}: {
  description: string;
  label: string;
}) {
  return (
    <div className="coss-container coss-page coss-stack">
      <PageHeader title={label} description={description} />
      <CardFrame
        aria-busy="true"
        aria-label={`Loading ${label}`}
        aria-live="polite"
        role="status"
      >
        <CardContent className="coss-stack">
          <Skeleton className="h-8.5 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-56 w-full" />
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
    <div
      className={cn(
        columns === 2 && "coss-grid-2",
        columns === 3 && "coss-grid-3",
        columns === 4 && "coss-grid-4",
      )}
    >
      {items.map((item) => (
        <Card key={item.title}>
          <CardContent className="coss-stack-sm">
            {item.meta ? <Badge variant="info">{item.meta}</Badge> : null}
            <strong>{item.title}</strong>
            <p className="coss-card-description">{item.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
