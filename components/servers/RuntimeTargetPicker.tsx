"use client";

import { useId } from "react";
import { useT } from "@/lib/i18n/client";
import type { RuntimeView } from "@/lib/servers/model";
import { isSelectableRuntime } from "@/lib/servers/model";
import { PublicPrice } from "./RuntimeAccessEditor";

export default function RuntimeTargetPicker({
  targets,
  value,
  onChange,
  disabled,
  allowAuto = true,
  excludeId,
  label = "Runtime target",
}: {
  targets: RuntimeView[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  allowAuto?: boolean;
  excludeId?: string;
  label?: string;
}) {
  const t = useT();
  const id = useId();
  const available = targets.filter(
    (r) => r.id !== excludeId && isSelectableRuntime(r),
  );
  const selected = available.find((r) => r.id === value);
  const groups = [
    { key: "internal", label: "Internal cluster" },
    { key: "owned", label: "Your servers" },
    { key: "public", label: "Public servers" },
    { key: "shared", label: "Shared with you" },
  ];
  return (
    <div className="runtime-picker">
      <label htmlFor={id}>{t(label)}</label>
      <select
        id={id}
        className="input"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">
          {t(allowAuto ? "Auto-assign" : "Choose a server")}
        </option>
        {value && !selected && (
          <option value={value} disabled>
            {t("Current selection is unavailable")}: {value}
          </option>
        )}
        {groups.map((group) => {
          const rows = available.filter((r) => r.kind === group.key);
          return rows.length ? (
            <optgroup label={t(group.label)} key={group.key}>
              {rows.map((r) => (
                <option value={r.id} key={r.id}>
                  {[r.name, r.country, r.location].filter(Boolean).join(" · ")}
                </option>
              ))}
            </optgroup>
          ) : null;
        })}
      </select>
      {selected && (
        <p className="form-hint">
          {selected.owned
            ? t("Your server")
            : selected.kind === "public"
              ? t("Public server")
              : selected.kind === "shared"
                ? t("Shared with you")
                : t("Internal capacity")}
          {selected.country ? ` · ${selected.country}` : ""}
          {selected.sharing === "public" && (
            <>
              {" "}
              · <PublicPrice offer={selected.public_offer} />
            </>
          )}
        </p>
      )}
    </div>
  );
}
