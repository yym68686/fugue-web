import { ButtonLink } from "@/components/ui/button";

type EmptyStateAction = {
  href: string;
  label: string;
  variant?: "ghost" | "primary";
};

export function ConsoleEmptyState({
  action,
  description,
  title,
}: {
  action?: EmptyStateAction;
  description: string;
  title: string;
}) {
  return (
    <div className="fg-console-empty-state">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>

      {action ? (
        <div className="fg-console-empty-state__actions">
          <ButtonLink href={action.href} variant={action.variant ?? "ghost"}>
            {action.label}
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}
