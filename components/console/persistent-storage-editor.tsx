"use client";

import { ConsoleDisclosureSection } from "@/components/console/console-disclosure-section";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SelectField } from "@/components/ui/select-field";
import {
  createPersistentStorageMountDraft,
  type PersistentStorageMountDraft,
} from "@/lib/fugue/persistent-storage";

type PersistentStorageEditorProps = {
  disabled?: boolean;
  idPrefix: string;
  surface?: "console" | "deploy";
  value: PersistentStorageMountDraft[];
  onChange: (next: PersistentStorageMountDraft[]) => void;
};

function readMountLabel(mount: PersistentStorageMountDraft) {
  return mount.kind === "file" ? "File" : "Directory";
}

function readMountDescription(mount: PersistentStorageMountDraft, index: number) {
  const normalizedPath = mount.path.trim();

  if (normalizedPath) {
    return normalizedPath;
  }

  return `Mount ${index + 1}`;
}

export function PersistentStorageEditor({
  disabled = false,
  idPrefix,
  surface = "console",
  value,
  onChange,
}: PersistentStorageEditorProps) {
  const actionClassName =
    surface === "deploy" ? "fg-deploy-inline-actions" : "fg-settings-form__actions";
  const gridClassName =
    surface === "deploy" ? "fg-deploy-form-grid" : "fg-console-dialog__advanced-grid";
  const textareaClassName =
    surface === "deploy"
      ? "fg-input fg-deploy-seed-textarea"
      : "fg-input fg-console-seed-textarea";

  function appendMount(kind: PersistentStorageMountDraft["kind"]) {
    onChange([...value, createPersistentStorageMountDraft(kind)]);
  }

  function updateMount(
    mountId: string,
    patch: Partial<PersistentStorageMountDraft>,
  ) {
    onChange(
      value.map((mount) =>
        mount.id === mountId
          ? {
              ...mount,
              ...patch,
            }
          : mount,
      ),
    );
  }

  function removeMount(mountId: string) {
    onChange(value.filter((mount) => mount.id !== mountId));
  }

  return (
    <div className="fg-field-stack">
      {value.length === 0 ? (
        <InlineAlert variant="info">
          Add a directory or file mount to keep it across redeploys, restarts,
          runtime moves, and failover.
        </InlineAlert>
      ) : null}

      <div className={actionClassName}>
        <Button
          disabled={disabled}
          onClick={() => appendMount("directory")}
          size="compact"
          type="button"
          variant="secondary"
        >
          Add directory
        </Button>
        <Button
          disabled={disabled}
          onClick={() => appendMount("file")}
          size="compact"
          type="button"
          variant="secondary"
        >
          Add file
        </Button>
      </div>

      {value.length > 0 ? (
        <div className="fg-console-dialog__advanced-grid">
          {value.map((mount, index) => {
            const mountLabel = readMountLabel(mount);
            const mountDescription = readMountDescription(mount, index);
            const mountIdPrefix = `${idPrefix}-${mount.id}`;

            return (
              <ConsoleDisclosureSection
                className="fg-console-dialog__advanced"
                defaultOpen
                description={mountDescription}
                key={mount.id}
                summary={mountLabel}
              >
                <div className="fg-console-dialog__advanced-grid">
                  <div className={gridClassName}>
                    <FormField
                      hint="Directories keep whole trees. Files mount one exact path."
                      htmlFor={`${mountIdPrefix}-kind`}
                      label="Kind"
                    >
                      <SelectField
                        disabled={disabled}
                        id={`${mountIdPrefix}-kind`}
                        onChange={(event) =>
                          updateMount(mount.id, {
                            kind:
                              event.target.value === "file"
                                ? "file"
                                : "directory",
                          })
                        }
                        value={mount.kind}
                      >
                        <option value="directory">Directory</option>
                        <option value="file">File</option>
                      </SelectField>
                    </FormField>

                    <FormField
                      hint={
                        mount.kind === "file"
                          ? "Use the exact file path inside the service."
                          : "Use the directory path inside the service."
                      }
                      htmlFor={`${mountIdPrefix}-path`}
                      label="Mount path"
                    >
                      <input
                        autoCapitalize="none"
                        autoComplete="off"
                        className="fg-input"
                        disabled={disabled}
                        id={`${mountIdPrefix}-path`}
                        onChange={(event) =>
                          updateMount(mount.id, {
                            path: event.target.value,
                          })
                        }
                        placeholder={
                          mount.kind === "file"
                            ? "/srv/config.json"
                            : "/var/lib/data"
                        }
                        spellCheck={false}
                        value={mount.path}
                      />
                    </FormField>
                  </div>

                  {mount.kind === "file" ? (
                    <FormField
                      hint="Used only when Fugue needs to create the file for the first time. Existing file contents stay in place on later deploys."
                      htmlFor={`${mountIdPrefix}-seed-content`}
                      label="Initial contents"
                      optionalLabel="Optional"
                    >
                      <textarea
                        autoCapitalize="off"
                        autoCorrect="off"
                        className={textareaClassName}
                        disabled={disabled}
                        id={`${mountIdPrefix}-seed-content`}
                        onChange={(event) =>
                          updateMount(mount.id, {
                            seedContent: event.target.value,
                          })
                        }
                        placeholder="Leave blank to create an empty file."
                        spellCheck={false}
                        value={mount.seedContent}
                      />
                    </FormField>
                  ) : null}

                  <div className={actionClassName}>
                    <Button
                      disabled={disabled}
                      onClick={() => removeMount(mount.id)}
                      size="compact"
                      type="button"
                      variant="danger"
                    >
                      Remove mount
                    </Button>
                  </div>
                </div>
              </ConsoleDisclosureSection>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
