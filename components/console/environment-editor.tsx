"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  SegmentedControl,
  type SegmentedControlOption,
} from "@/components/ui/segmented-control";
import type { EnvEntry } from "@/lib/console/env-editor";
import {
  parseRawEnvInput,
  serializeEnvEntries,
} from "@/lib/console/env-editor";
import {
  buildRawEnvFeedback,
  type RawEnvFeedback,
} from "@/lib/console/raw-env";

type EnvironmentEditorMode = "variables" | "raw";
type EnvironmentEditorSurface = "console" | "deploy";

type EnvironmentEditorRow = {
  id: string;
  key: string;
  value: string;
};

type EnvironmentEditorProps = {
  fieldId: string;
  onChange: (value: string) => void;
  onStatusChange?: (feedback: RawEnvFeedback) => void;
  surface?: EnvironmentEditorSurface;
  value: string;
};

const ENVIRONMENT_EDITOR_MODE_OPTIONS: readonly SegmentedControlOption<EnvironmentEditorMode>[] =
  [
    { label: "Variables", value: "variables" },
    { label: "Raw", value: "raw" },
  ];

const DEFAULT_PLACEHOLDER = `DATABASE_URL=postgres://user:pass@host/db
PUBLIC_API_BASE=https://api.example.com
# comments are ignored`;

function createEnvironmentRowId() {
  return `env-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function rowsFromEntries(entries: EnvEntry[]) {
  return entries.map((entry) => ({
    id: createEnvironmentRowId(),
    key: entry.key,
    value: entry.value,
  }));
}

function buildRowError(message: string): RawEnvFeedback {
  return {
    env: {},
    message,
    valid: false,
    variant: "error",
  };
}

function readRawState(
  raw: string,
  surface: EnvironmentEditorSurface,
) {
  const parsed = parseRawEnvInput(raw);

  if (!parsed.ok) {
    return {
      feedback: buildRowError(`Line ${parsed.line}: ${parsed.message}`),
      rows: null,
    };
  }

  return {
    feedback: buildRawEnvFeedback(raw, surface),
    rows: rowsFromEntries(parsed.entries),
  };
}

function buildRowState(
  rows: EnvironmentEditorRow[],
  surface: EnvironmentEditorSurface,
) {
  const activeRows = rows.filter(
    (row) => row.key.trim().length > 0 || row.value.length > 0,
  );
  const emptyKeyRow = activeRows.find((row) => row.key.trim().length === 0);

  if (emptyKeyRow) {
    return {
      feedback: buildRowError("Environment variable names cannot be empty."),
      raw: null,
    };
  }

  const seenKeys = new Set<string>();
  const duplicateKeys = new Set<string>();
  const entries: EnvEntry[] = [];

  for (const row of rows) {
    const key = row.key.trim();

    if (!key) {
      continue;
    }

    if (seenKeys.has(key)) {
      duplicateKeys.add(key);
    }

    seenKeys.add(key);
    entries.push({
      key,
      value: row.value,
    });
  }

  if (duplicateKeys.size > 0) {
    return {
      feedback: buildRowError(
        `Duplicate env keys: ${[...duplicateKeys].sort().join(", ")}.`,
      ),
      raw: null,
    };
  }

  const raw = serializeEnvEntries(entries);

  return {
    feedback: buildRawEnvFeedback(raw, surface),
    raw,
  };
}

export function EnvironmentEditor({
  fieldId,
  onChange,
  onStatusChange,
  surface = "console",
  value,
}: EnvironmentEditorProps) {
  const initialState = readRawState(value, surface);
  const [mode, setMode] = useState<EnvironmentEditorMode>("variables");
  const [rows, setRows] = useState<EnvironmentEditorRow[]>(
    initialState.rows ?? [],
  );
  const [feedback, setFeedback] = useState<RawEnvFeedback>(
    initialState.feedback,
  );

  function publishFeedback(nextFeedback: RawEnvFeedback) {
    setFeedback(nextFeedback);
    onStatusChange?.(nextFeedback);
  }

  useEffect(() => {
    const nextState = readRawState(value, surface);

    publishFeedback(nextState.feedback);

    if (nextState.rows) {
      setRows(nextState.rows);
      return;
    }

    setMode("raw");
  }, [onStatusChange, surface, value]);

  function applyRows(nextRows: EnvironmentEditorRow[]) {
    const nextState = buildRowState(nextRows, surface);

    setRows(nextRows);
    publishFeedback(nextState.feedback);

    if (nextState.raw !== null && nextState.raw !== value) {
      onChange(nextState.raw);
    }
  }

  function addRow() {
    applyRows([
      ...rows,
      {
        id: createEnvironmentRowId(),
        key: "",
        value: "",
      },
    ]);
  }

  function updateRow(
    rowId: string,
    field: "key" | "value",
    nextValue: string,
  ) {
    applyRows(
      rows.map((row) =>
        row.id === rowId ? { ...row, [field]: nextValue } : row,
      ),
    );
  }

  function removeRow(rowId: string) {
    applyRows(rows.filter((row) => row.id !== rowId));
  }

  function updateRaw(nextValue: string) {
    const nextState = readRawState(nextValue, surface);

    publishFeedback(nextState.feedback);

    if (nextState.rows) {
      setRows(nextState.rows);
    }

    if (nextValue !== value) {
      onChange(nextValue);
    }
  }

  const modeOptions = ENVIRONMENT_EDITOR_MODE_OPTIONS.map((option) => ({
    ...option,
    disabled: !feedback.valid && option.value !== mode,
  }));

  return (
    <div className="fg-env-editor">
      <div className="fg-env-editor__toolbar">
        <SegmentedControl
          ariaLabel="Environment edit modes"
          controlClassName="fg-console-nav"
          itemClassName="fg-console-nav__link"
          labelClassName="fg-console-nav__title"
          onChange={setMode}
          options={modeOptions}
          value={mode}
          variant="pill"
        />

        {mode === "variables" ? (
          <Button onClick={addRow} size="compact" type="button" variant="secondary">
            Add variable
          </Button>
        ) : value.trim() ? (
          <Button
            onClick={() => updateRaw("")}
            size="compact"
            type="button"
            variant="secondary"
          >
            Clear raw
          </Button>
        ) : null}
      </div>

      {mode === "variables" ? (
        <div className="fg-env-table fg-env-editor__table">
          {rows.length > 0 ? (
            <>
              <div aria-hidden="true" className="fg-env-table__head">
                <span>Key</span>
                <span>Value</span>
                <span>Action</span>
              </div>

              {rows.map((row, index) => {
                const rowTitle = row.key || `Variable ${index + 1}`;

                return (
                  <div className="fg-env-row" key={row.id}>
                    <div aria-hidden="true" className="fg-env-row__header">
                      <div className="fg-env-row__identity">
                        <p className="fg-env-row__eyebrow">{`Variable ${index + 1}`}</p>
                        <p className="fg-env-row__title">{rowTitle}</p>
                      </div>
                    </div>

                    <label className="fg-env-row__field fg-env-row__field--key">
                      <span className="fg-env-row__field-label">Variable name</span>
                      <input
                        aria-invalid={feedback.valid ? undefined : true}
                        autoCapitalize="off"
                        autoComplete="off"
                        autoCorrect="off"
                        className="fg-input"
                        name={`${fieldId}-key-${row.id}`}
                        onChange={(event) =>
                          updateRow(row.id, "key", event.target.value)
                        }
                        placeholder="API_KEY"
                        spellCheck={false}
                        translate="no"
                        value={row.key}
                      />
                    </label>

                    <label className="fg-env-row__field fg-env-row__field--value">
                      <span className="fg-env-row__field-label">Value</span>
                      <input
                        aria-invalid={feedback.valid ? undefined : true}
                        autoCapitalize="off"
                        autoComplete="off"
                        autoCorrect="off"
                        className="fg-input"
                        name={`${fieldId}-value-${row.id}`}
                        onChange={(event) =>
                          updateRow(row.id, "value", event.target.value)
                        }
                        placeholder="Value"
                        spellCheck={false}
                        translate="no"
                        value={row.value}
                      />
                    </label>

                    <div className="fg-env-row__action">
                      <Button
                        aria-label={`Remove ${rowTitle}`}
                        onClick={() => removeRow(row.id)}
                        size="tight"
                        type="button"
                        variant="ghost"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <p className="fg-env-editor__empty">No variables yet.</p>
          )}
        </div>
      ) : (
        <div className="fg-env-raw">
          <FormField htmlFor={fieldId} label="Paste .env">
            <textarea
              aria-invalid={feedback.valid ? undefined : true}
              autoCapitalize="off"
              autoCorrect="off"
              className="fg-project-textarea fg-env-raw__textarea"
              id={fieldId}
              name={`${fieldId}-raw`}
              onChange={(event) => updateRaw(event.target.value)}
              placeholder={DEFAULT_PLACEHOLDER}
              spellCheck={false}
              translate="no"
              value={value}
            />
          </FormField>
        </div>
      )}

      <InlineAlert variant={feedback.variant}>{feedback.message}</InlineAlert>
    </div>
  );
}
