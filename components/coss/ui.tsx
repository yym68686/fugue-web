import Link from "next/link";
import {
  cloneElement,
  isValidElement,
  type ComponentProps,
  type CSSProperties,
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
type ButtonSize = "default" | "sm" | "xs" | "icon";
type CossStyle = CSSProperties & Record<`--coss-${string}`, string | number>;

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
  disabled,
  type,
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
      data-loading={loading || undefined}
      data-slot="button"
      disabled={disabled || loading}
      type={type ?? "button"}
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
      data-slot="button"
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
  return (
    <section className={cn("coss-card-frame", className)} data-slot="card-frame">
      {children}
    </section>
  );
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
    <section
      className={cn("coss-card", muted && "coss-card--muted", className)}
      data-slot="card"
    >
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
    <header className="coss-card__header" data-slot="card-header">
      <div>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </div>
      {action ? <CardAction>{action}</CardAction> : null}
    </header>
  );
}

export function CardTitle({
  children,
  className,
  ...props
}: ComponentProps<"h3">) {
  return (
    <h3 className={cn("coss-card-title", className)} data-slot="card-title" {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className,
  ...props
}: ComponentProps<"p">) {
  return (
    <p
      className={cn("coss-card-description", className)}
      data-slot="card-description"
      {...props}
    >
      {children}
    </p>
  );
}

export function CardAction({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("coss-card__action", className)} data-slot="card-action">
      {children}
    </div>
  );
}

export function CardContent({
  children,
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div className={cn("coss-card__content", className)} data-slot="card-content" {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="coss-card__footer" data-slot="card-footer">
      {children}
    </footer>
  );
}

export function Frame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("coss-frame", className)} data-slot="frame">
      {children}
    </div>
  );
}

export function FramePanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("coss-frame__panel", className)} data-slot="frame-panel">
      {children}
    </div>
  );
}

export function Stack({
  children,
  className,
  size = "default",
}: {
  children: ReactNode;
  className?: string;
  size?: "default" | "sm";
}) {
  return (
    <div
      className={cn(size === "sm" ? "coss-stack-sm" : "coss-stack", className)}
      data-slot="stack"
    >
      {children}
    </div>
  );
}

export function Inline({
  children,
  className,
  justify = "start",
}: {
  children: ReactNode;
  className?: string;
  justify?: "start" | "between" | "end" | "center";
}) {
  return (
    <div
      className={cn("coss-row", justify !== "start" && `coss-row--${justify}`, className)}
      data-slot="inline"
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={cn("coss-badge", tone !== "default" && `coss-badge--${tone}`)}
      data-slot="badge"
    >
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
      data-slot="alert"
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
    <div className="coss-empty" data-slot="empty">
      <span className="coss-empty__icon">
        <CircleDashed aria-hidden="true" />
      </span>
      <div>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
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
    <div className="coss-meter" data-slot="meter">
      <Inline justify="between">
        <span className="coss-help">{label}</span>
        <span className="coss-help coss-mono">
          {normalized}
          {suffix}
        </span>
      </Inline>
      <div className="coss-meter__bar" aria-hidden="true">
        <div
          className="coss-meter__value"
          style={{ "--coss-meter-value": `${normalized}%` } as CossStyle}
        />
      </div>
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn("coss-input", className)} data-slot="input" {...props} />;
}

export function InputButton({
  className,
  type,
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      className={cn("coss-input coss-input-button", className)}
      data-slot="input-button"
      type={type ?? "button"}
      {...props}
    />
  );
}

export function HiddenInput(props: ComponentProps<"input">) {
  return <input type="hidden" {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn("coss-textarea", className)}
      data-slot="textarea"
      {...props}
    />
  );
}

export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn("coss-select", className)}
      data-slot="select"
      {...props}
    />
  );
}

export function TabsList({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn("coss-tabs", className)}
      data-slot="tabs-list"
      role="tablist"
      aria-label={label}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  children,
  className,
  selected,
  ...props
}: ComponentProps<"button"> & {
  selected: boolean;
}) {
  return (
    <button
      className={cn("coss-tab", className)}
      data-slot="tabs-trigger"
      aria-selected={selected}
      role="tab"
      type="button"
      {...props}
    >
      {children}
    </button>
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
  const normalizedLabel =
    label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") ||
    "field";
  const fallbackId = `coss-field-${normalizedLabel}`;
  const helpId = help ? `${fallbackId}-help` : undefined;
  const control = isValidElement<{ id?: string; "aria-describedby"?: string }>(
    children,
  )
    ? cloneElement(children, {
        id: children.props.id ?? fallbackId,
        "aria-describedby":
          [children.props["aria-describedby"], helpId].filter(Boolean).join(" ") ||
          undefined,
      })
    : children;
  const controlId = isValidElement<{ id?: string }>(control)
    ? control.props.id
    : fallbackId;

  return (
    <div className="coss-field" data-slot="field">
      <label htmlFor={controlId}>{label}</label>
      {control}
      {help ? (
        <span className="coss-help" id={helpId}>
          {help}
        </span>
      ) : null}
    </div>
  );
}

export function CodeBlock({ children }: { children: ReactNode }) {
  return (
    <pre className="coss-code" data-slot="code">
      <code>{children}</code>
    </pre>
  );
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
    <header
      className={cn("coss-page-header", center && "coss-page-header--center")}
      data-slot="page-header"
    >
      {eyebrow ? <span className="coss-eyebrow">{eyebrow}</span> : null}
      <Inline justify="between">
        <Stack size="sm">
          <h1 className="coss-page-title">{title}</h1>
          {description ? <p className="coss-page-description">{description}</p> : null}
        </Stack>
        {action}
      </Inline>
    </header>
  );
}

export function MetricStrip({
  items,
}: {
  items: Array<{ label: string; value: string; tone?: Tone }>;
}) {
  return (
    <div className="coss-grid-4" data-slot="metric-grid">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent>
            <Stack size="sm">
              <span className="coss-help">{item.label}</span>
              <strong className="coss-metric-value">{item.value}</strong>
              {item.tone ? <Badge tone={item.tone}>{item.tone}</Badge> : null}
            </Stack>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function Table({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="coss-table-wrap" data-slot="table-container">
      <table className={cn("coss-table", className)} data-slot="table">
        {children}
      </table>
    </div>
  );
}

export function TableHeader(props: ComponentProps<"thead">) {
  return <thead data-slot="table-header" {...props} />;
}

export function TableBody(props: ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" {...props} />;
}

export function TableRow(props: ComponentProps<"tr">) {
  return <tr data-slot="table-row" {...props} />;
}

export function TableHead(props: ComponentProps<"th">) {
  return <th data-slot="table-head" {...props} />;
}

export function TableCell(props: ComponentProps<"td">) {
  return <td data-slot="table-cell" {...props} />;
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
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>{rows.map((row) => renderRow(row))}</TableBody>
    </Table>
  );
}

export function SkeletonBlock({ height = 20 }: { height?: number }) {
  return (
    <div
      className="coss-skeleton"
      data-slot="skeleton"
      style={{ "--coss-skeleton-height": `${height}px` } as CossStyle}
    />
  );
}

export function Drawer({
  title,
  description,
  open,
  onClose,
  children,
  footer,
}: {
  title: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;

  return (
    <>
      <div className="coss-drawer-backdrop" data-slot="drawer-backdrop" onClick={onClose} />
      <aside
        className="coss-drawer"
        data-slot="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        <header className="coss-overlay-header" data-slot="drawer-header">
          <div>
            <CardTitle id="drawer-title">{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>
        <div className="coss-overlay-body" data-slot="drawer-body">
          {children}
        </div>
        {footer ? (
          <footer className="coss-overlay-footer" data-slot="drawer-footer">
            {footer}
          </footer>
        ) : null}
      </aside>
    </>
  );
}

export function ConfirmDialog({
  title,
  description,
  open,
  confirmDisabled = false,
  confirmLabel = "Confirm",
  confirmLoading = false,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  open: boolean;
  confirmDisabled?: boolean;
  confirmLabel?: string;
  confirmLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <>
      <div className="coss-dialog-backdrop" data-slot="dialog-backdrop" onClick={onClose} />
      <section
        className="coss-dialog"
        data-slot="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <header className="coss-overlay-header" data-slot="dialog-header">
          <div>
            <CardTitle id="dialog-title">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </header>
        <footer className="coss-overlay-footer" data-slot="dialog-footer">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={confirmDisabled || confirmLoading}
            loading={confirmLoading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </footer>
      </section>
    </>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="coss-toast" data-slot="toast" role="status">
      {message}
    </div>
  );
}
