import Link from "next/link";
import {
  cloneElement,
  isValidElement,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Info,
  Loader2,
  TriangleAlert,
} from "lucide-react";

type Tone = "default" | "success" | "warning" | "destructive" | "info";
type ButtonVariant =
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive";
type ButtonSize = "default" | "sm" | "icon";

export function cn(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}

export function Button({
  children,
  className,
  variant = "default",
  size = "default",
  loading = false,
  ...props
}: ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      className={cn(
        "coss-button",
        variant !== "default" && `coss-button--${variant}`,
        size !== "default" && `coss-button--${size}`,
        className,
      )}
      aria-busy={loading || undefined}
      disabled={props.disabled || loading}
      {...props}
    >
      {loading ? <Loader2 aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  className,
  variant = "default",
  size = "default",
  href,
  ...props
}: ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "coss-button",
        variant !== "default" && `coss-button--${variant}`,
        size !== "default" && `coss-button--${size}`,
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

export function CardFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn("coss-card-frame", className)}>{children}</section>;
}

export function Card({
  children,
  className,
  muted = false,
}: {
  children: ReactNode;
  className?: string;
  muted?: boolean;
}) {
  return (
    <section className={cn("coss-card", muted && "coss-card--muted", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="coss-card__header">
      <div>
        <h3 className="coss-card-title">{title}</h3>
        {description ? <p className="coss-card-description">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function CardContent({
  children,
  className,
  ...props
}: ComponentProps<"div">) {
  return <div className={cn("coss-card__content", className)} {...props}>{children}</div>;
}

export function CardFooter({
  children,
}: {
  children: ReactNode;
}) {
  return <footer className="coss-card__footer">{children}</footer>;
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span className={cn("coss-badge", tone !== "default" && `coss-badge--${tone}`)}>
      {children}
    </span>
  );
}

function alertIcon(tone: Tone) {
  if (tone === "success") return <CheckCircle2 aria-hidden="true" />;
  if (tone === "warning") return <TriangleAlert aria-hidden="true" />;
  if (tone === "destructive") return <AlertCircle aria-hidden="true" />;
  if (tone === "info") return <Info aria-hidden="true" />;
  return <CircleDashed aria-hidden="true" />;
}

export function Alert({
  title,
  children,
  tone = "default",
}: {
  title: ReactNode;
  children?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div
      className={cn("coss-alert", tone !== "default" && `coss-alert--${tone}`)}
      role={tone === "destructive" ? "alert" : "status"}
    >
      <span>{alertIcon(tone)}</span>
      <div>
        <strong>{title}</strong>
        {children ? <div className="coss-help">{children}</div> : null}
      </div>
    </div>
  );
}

export function Empty({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="coss-empty">
      <span className="coss-empty__icon">
        <CircleDashed aria-hidden="true" />
      </span>
      <div>
        <h3 className="coss-card-title">{title}</h3>
        {description ? <p className="coss-card-description">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Meter({
  label,
  value,
  suffix = "%",
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  const normalized = Math.max(0, Math.min(100, value));
  return (
    <div className="coss-meter">
      <div className="coss-row" style={{ justifyContent: "space-between" }}>
        <span className="coss-help">{label}</span>
        <span className="coss-help coss-mono">
          {normalized}
          {suffix}
        </span>
      </div>
      <div className="coss-meter__bar" aria-hidden="true">
        <div className="coss-meter__value" style={{ width: `${normalized}%` }} />
      </div>
    </div>
  );
}

export function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: ReactNode;
  children: ReactNode;
}) {
  const normalizedLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "field";
  const fallbackId = `coss-field-${normalizedLabel}`;
  const helpId = help ? `${fallbackId}-help` : undefined;
  const control = isValidElement<{ id?: string; "aria-describedby"?: string }>(children)
    ? cloneElement(children, {
        id: children.props.id ?? fallbackId,
        "aria-describedby": [children.props["aria-describedby"], helpId].filter(Boolean).join(" ") || undefined,
      })
    : children;
  const controlId = isValidElement<{ id?: string }>(control) ? control.props.id : fallbackId;

  return (
    <div className="coss-field">
      <label htmlFor={controlId}>{label}</label>
      {control}
      {help ? <span className="coss-help" id={helpId}>{help}</span> : null}
    </div>
  );
}

export function CodeBlock({
  children,
}: {
  children: ReactNode;
}) {
  return <pre className="coss-code"><code>{children}</code></pre>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  center = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  center?: boolean;
}) {
  return (
    <header className={cn("coss-page-header", center && "coss-page-header--center")}>
      {eyebrow ? <span className="coss-eyebrow">{eyebrow}</span> : null}
      <div className="coss-row" style={{ justifyContent: "space-between" }}>
        <div className="coss-stack-sm">
          <h1 className="coss-page-title">{title}</h1>
          {description ? <p className="coss-page-description">{description}</p> : null}
        </div>
        {action}
      </div>
    </header>
  );
}

export function MetricStrip({
  items,
}: {
  items: Array<{ label: string; value: string; tone?: Tone }>;
}) {
  return (
    <div className="coss-grid-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="coss-stack-sm">
            <span className="coss-help">{item.label}</span>
            <strong style={{ fontSize: 24 }}>{item.value}</strong>
            {item.tone ? <Badge tone={item.tone}>{item.tone}</Badge> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function DataTable<Row extends { id: string }>({
  columns,
  rows,
  renderRow,
}: {
  columns: string[];
  rows: Row[];
  renderRow: (row: Row) => ReactNode;
}) {
  return (
    <div className="coss-table-wrap">
      <table className="coss-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>{rows.map((row) => renderRow(row))}</tbody>
      </table>
    </div>
  );
}

export function SkeletonBlock({
  height = 20,
}: {
  height?: number;
}) {
  return <div className="coss-skeleton" style={{ height }} />;
}
