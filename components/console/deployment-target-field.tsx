import { StatusBadge } from "@/components/console/status-badge";
import { useI18n } from "@/components/providers/i18n-provider";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SelectField } from "@/components/ui/select-field";
import type { ConsoleImportRuntimeTargetView } from "@/lib/console/gallery-types";
import {
  buildImportRuntimeTargetGroups,
  readDefaultRuntimeIdForTargetGroup,
  readRuntimeTargetOptionLabel,
  readSelectedRuntimeTargetGroupId,
  type ConsoleImportRuntimeTargetGroupView,
} from "@/lib/console/runtime-targets";

const DEFAULT_INTERNAL_CLUSTER_TARGET = {
  category: "internal-cluster",
  description: "Deploy onto the internal cluster.",
  id: "runtime_managed_shared",
  kindLabel: "Internal cluster",
  locationCountryCode: null,
  locationCountryLabel: null,
  locationLabel: null,
  primaryLabel: "Internal cluster",
  runtimeType: "managed-shared",
  statusLabel: null,
  statusTone: null,
  summaryLabel: "Internal cluster",
} satisfies ConsoleImportRuntimeTargetView;

function RuntimeTargetCard({
  group,
  inputId,
  isSelected,
  name,
  onChange,
  readOnly = false,
}: {
  group: ConsoleImportRuntimeTargetGroupView;
  inputId: string;
  isSelected: boolean;
  name: string;
  onChange?: (groupId: string) => void;
  readOnly?: boolean;
}) {
  const shouldShowStatus = Boolean(group.statusLabel && group.statusTone !== "positive");
  const content = (
    <>
      <span className="fg-runtime-target-card__head">
        <span className="fg-runtime-target-card__eyebrow">
          {group.kindLabel}
        </span>
        <span className="fg-runtime-target-card__head-side">
          {shouldShowStatus ? (
            <StatusBadge tone={group.statusTone ?? "neutral"}>
              {group.statusLabel}
            </StatusBadge>
          ) : null}
          <span
            aria-hidden="true"
            className="fg-runtime-target-card__indicator"
          />
        </span>
      </span>
      <span className="fg-runtime-target-card__primary">
        {group.primaryLabel}
      </span>
      <span className="fg-runtime-target-card__description">
        {group.description}
      </span>
    </>
  );

  if (readOnly) {
    return (
      <div
        aria-label={group.summaryLabel}
        className="fg-runtime-target-card fg-runtime-target-card--static"
        data-selected={isSelected ? "true" : undefined}
      >
        <div className="fg-runtime-target-card__surface">{content}</div>
      </div>
    );
  }

  return (
    <label className="fg-runtime-target-card" htmlFor={inputId}>
      <input
        checked={isSelected}
        className="fg-runtime-target-card__input"
        id={inputId}
        name={name}
        onChange={() => onChange?.(group.id)}
        type="radio"
        value={group.id}
      />
      <span className="fg-runtime-target-card__surface">{content}</span>
    </label>
  );
}

export function DeploymentTargetField({
  fallbackToDefaultTarget = true,
  inventoryError,
  inventoryMessage,
  legendLabel,
  name,
  onChange,
  regionLabel,
  targets,
  value,
}: {
  fallbackToDefaultTarget?: boolean;
  inventoryError?: string | null;
  inventoryMessage?: string;
  legendLabel?: string;
  name: string;
  onChange?: (runtimeId: string | null) => void;
  regionLabel?: string;
  targets: ConsoleImportRuntimeTargetView[];
  value: string | null;
}) {
  const { locale, t } = useI18n();
  const resolvedInventoryMessage =
    inventoryMessage ??
    t(
      "Deployment targets are unavailable. This import will use the default internal cluster.",
    );
  const resolvedLegendLabel = legendLabel ?? t("Deployment target");
  const resolvedRegionLabel = regionLabel ?? t("Deployment region");
  const availableTargets =
    targets.length > 0
      ? targets
      : fallbackToDefaultTarget
        ? [DEFAULT_INTERNAL_CLUSTER_TARGET]
        : [];
  const groups = buildImportRuntimeTargetGroups(availableTargets, locale);
  const selectedGroupId = readSelectedRuntimeTargetGroupId(groups, value);
  const selectedGroup =
    groups.find((group) => group.id === selectedGroupId) ??
    groups[0] ??
    null;
  const selectedRuntimeId =
    value && selectedGroup?.options.some((option) => option.id === value)
      ? value
      : readDefaultRuntimeIdForTargetGroup(selectedGroup) ?? "";
  const regionSelectId = `${name}-region`;

  function handleGroupChange(groupId: string) {
    const group = groups.find((item) => item.id === groupId);

    if (!group) {
      return;
    }

    onChange?.(readDefaultRuntimeIdForTargetGroup(group));
  }

  const regionHint =
    selectedGroup?.options.length === 1
      ? t("This target uses one fixed region.")
      : selectedGroup?.category === "internal-cluster"
        ? t(
            "Leave this on Any available region to let Fugue place the deployment.",
          )
        : t("Choose the machine region.");
  const fixedRegionLabel =
    selectedGroup?.options.length === 1
      ? readRuntimeTargetOptionLabel(
          selectedGroup.options[0] ?? DEFAULT_INTERNAL_CLUSTER_TARGET,
          locale,
        )
      : null;

  return (
    <fieldset className="fg-field-stack fg-runtime-target-field">
      <legend className="fg-field-label fg-runtime-target-field__legend">
        <span>{resolvedLegendLabel}</span>
      </legend>

      {inventoryError ? (
        <InlineAlert variant="info">
          {resolvedInventoryMessage}
        </InlineAlert>
      ) : null}

      <div className="fg-runtime-target-field__section">
        {groups.length > 1 ? (
          <div className="fg-runtime-target-list">
            {groups.map((group) => (
              <RuntimeTargetCard
                group={group}
                inputId={`${name}-${group.id}`}
                isSelected={group.id === selectedGroupId}
                key={group.id}
                name={`${name}-group`}
                onChange={handleGroupChange}
              />
            ))}
          </div>
        ) : selectedGroup ? (
          <RuntimeTargetCard
            group={selectedGroup}
            inputId={`${name}-${selectedGroup.id}`}
            isSelected
            name={name}
            readOnly
          />
        ) : null}
      </div>

      {selectedGroup ? (
        <div className="fg-runtime-target-field__section fg-runtime-target-field__section--region">
          <FormField
            hint={regionHint}
            htmlFor={regionSelectId}
            label={resolvedRegionLabel}
            optionalLabel={
              selectedGroup.options.length === 1 ? t("Fixed") : undefined
            }
          >
            {selectedGroup.options.length > 1 ? (
              <SelectField
                id={regionSelectId}
                onChange={(event) => onChange?.(event.target.value)}
                value={selectedRuntimeId}
              >
                {selectedGroup.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {readRuntimeTargetOptionLabel(option, locale)}
                  </option>
                ))}
              </SelectField>
            ) : (
              <output
                className="fg-static-choice"
                id={regionSelectId}
              >
                <span className="fg-static-choice__label">
                  {fixedRegionLabel}
                </span>
                <span className="fg-static-choice__meta">
                  {t("Only region available")}
                </span>
              </output>
            )}
          </FormField>
        </div>
      ) : null}
    </fieldset>
  );
}
