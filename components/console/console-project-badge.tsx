import { TechStackLogo } from "@/components/ui/tech-stack-logo";
import type { ConsoleGalleryBadgeKind } from "@/lib/console/gallery-types";

export function ConsoleProjectBadge({
  kind,
  label,
  meta,
}: {
  kind: ConsoleGalleryBadgeKind;
  label: string;
  meta: string;
}) {
  return (
    <div
      aria-label={`${label} / ${meta}`}
      className="fg-project-badge"
      data-kind={kind}
      role="img"
      title={`${label} / ${meta}`}
    >
      <span className="fg-project-badge__glyph">
        <TechStackLogo kind={kind} />
      </span>
      <span className="fg-project-badge__sr">{label}</span>
    </div>
  );
}
