"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { Button, InlineButton } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import { NODE_KEY_CREATE_REQUEST_EVENT } from "@/lib/console/events";
import {
  canUseNodeKeyForClusterJoin,
  sortNodeKeys,
} from "@/lib/node-keys/selection";
import type { NodeKeyRecord } from "@/lib/node-keys/types";
import { copyText } from "@/lib/ui/clipboard";

type NodeKeyPagePayload = {
  keys: NodeKeyRecord[];
  syncError: string | null;
};

type RenameState = {
  error: string | null;
  keyId: string;
  label: string;
};

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Request failed.";
}

function validateRenameLabel(label: string) {
  if (!label.trim()) {
    return "Node key name is required.";
  }

  return null;
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!data) {
    throw new Error("Empty response.");
  }

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function formatRelativeTime(value?: string | null) {
  if (!value) {
    return "Never";
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return "Never";
  }

  const deltaSeconds = Math.round((timestamp - Date.now()) / 1000);
  const units = [
    { amount: 60, unit: "second" as const },
    { amount: 60, unit: "minute" as const },
    { amount: 24, unit: "hour" as const },
    { amount: 7, unit: "day" as const },
    { amount: 4.34524, unit: "week" as const },
    { amount: 12, unit: "month" as const },
    { amount: Number.POSITIVE_INFINITY, unit: "year" as const },
  ];

  let valueForUnit = deltaSeconds;

  for (const { amount, unit } of units) {
    if (Math.abs(valueForUnit) < amount) {
      return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
        Math.trunc(valueForUnit),
        unit,
      );
    }

    valueForUnit /= amount;
  }

  return "Just now";
}

function upsertKey(keys: NodeKeyRecord[], nextKey: NodeKeyRecord) {
  return sortNodeKeys([
    ...keys.filter((key) => key.id !== nextKey.id),
    nextKey,
  ]);
}

function removeKey(keys: NodeKeyRecord[], keyId: string) {
  return sortNodeKeys(keys.filter((key) => key.id !== keyId));
}

function buildJoinCommand(apiBaseUrl: string, secret: string) {
  return `curl -fsSL ${apiBaseUrl}/install/join-cluster.sh | sudo FUGUE_NODE_KEY='${secret}' bash`;
}

function describeStatus(record: NodeKeyRecord) {
  if (record.status === "revoked") {
    return {
      primary: "Revoked",
      secondary: "Cannot join",
    };
  }

  if (!record.canCopy) {
    return {
      primary: "Active",
      secondary: "Secret hidden",
    };
  }

  return {
    primary: "Active",
    secondary: "Copyable",
  };
}

function describeAttachedVps(record: NodeKeyRecord) {
  if (record.attachedVpsCount === null) {
    return null;
  }

  return {
    primary: String(record.attachedVpsCount),
    secondary: "VPS",
  };
}

function readFocusableElements(container: HTMLElement | null) {
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => {
      const style = window.getComputedStyle(element);

      return style.display !== "none" && style.visibility !== "hidden";
    },
  );
}

export function NodeKeyManager({
  apiBaseUrl,
  initialKeys,
  initialSyncError,
}: {
  apiBaseUrl: string;
  initialKeys: NodeKeyRecord[];
  initialSyncError: string | null;
}) {
  const confirm = useConfirmDialog();
  const { showToast } = useToast();
  const createRequestRef = useRef<() => void>(() => {});
  const copyInFlightRef = useRef<string | null>(null);
  const renameDialogRef = useRef<HTMLDivElement | null>(null);
  const renameBackdropPressStartedRef = useRef(false);
  const renameReturnFocusRef = useRef<HTMLElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const normalizedApiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
  const [keys, setKeys] = useState(() => sortNodeKeys(initialKeys));
  const [syncError, setSyncError] = useState<string | null>(initialSyncError);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [renameState, setRenameState] = useState<RenameState | null>(null);
  const renameRecord = renameState
    ? keys.find((key) => key.id === renameState.keyId) ?? null
    : null;
  const renameBusy = renameRecord
    ? busyAction === `rename:${renameRecord.id}`
    : false;
  const renameDialogIdBase = renameRecord?.id ?? "node-key-rename";
  const renameTitleId = `node-key-rename-title-${renameDialogIdBase}`;
  const renameDescriptionId = `node-key-rename-description-${renameDialogIdBase}`;
  const renameFormId = `node-key-rename-form-${renameDialogIdBase}`;
  const renameFieldId = `node-key-rename-field-${renameDialogIdBase}`;
  const renameChanged =
    renameRecord && renameState
      ? renameState.label.trim() !== renameRecord.label
      : false;

  useEffect(() => {
    if (!initialSyncError) {
      return;
    }

    showToast({
      message: "Showing stored node key metadata while live sync is unavailable.",
      variant: "info",
    });
  }, [initialSyncError, showToast]);

  useEffect(() => {
    const handleCreateRequest = () => {
      createRequestRef.current();
    };

    window.addEventListener(NODE_KEY_CREATE_REQUEST_EVENT, handleCreateRequest);

    return () => {
      window.removeEventListener(NODE_KEY_CREATE_REQUEST_EVENT, handleCreateRequest);
    };
  }, []);

  useEffect(() => {
    if (!renameRecord) {
      return;
    }

    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const frame = window.requestAnimationFrame(() => {
      const input = renameInputRef.current;

      input?.focus({ preventScroll: true });
      input?.select();
    });

    return () => {
      renameBackdropPressStartedRef.current = false;
      window.cancelAnimationFrame(frame);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [renameRecord]);

  useEffect(() => {
    if (!renameState) {
      return;
    }

    if (renameRecord) {
      return;
    }

    dismissRenameDialog(false);
  }, [renameRecord, renameState]);

  function syncLocalState(data: NodeKeyPagePayload) {
    setKeys(sortNodeKeys(data.keys));
    setSyncError(data.syncError);
  }

  async function refreshKeys() {
    const data = await requestJson<NodeKeyPagePayload>("/api/fugue/node-keys", {
      cache: "no-store",
    });

    syncLocalState(data);

    return data;
  }

  async function handleRefresh() {
    if (busyAction) {
      return;
    }

    setBusyAction("refresh");

    try {
      const data = await refreshKeys();

      showToast({
        message: data.syncError
          ? "Live sync is still unavailable. Stored node key metadata remains visible."
          : "Node key list refreshed.",
        variant: data.syncError ? "info" : "success",
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreate() {
    if (busyAction) {
      return;
    }

    setBusyAction("create");

    try {
      const createRequest = requestJson<{
        key: NodeKeyRecord;
        secret: string;
      }>("/api/fugue/node-keys", {
        method: "POST",
      });
      const copiedPromise = copyText(createRequest.then((data) => data.secret));
      const created = await createRequest;
      const copied = await copiedPromise;
      const nextKeys = upsertKey(keys, created.key);

      setKeys(nextKeys);
      setSyncError(null);

      showToast({
        message: copied ? "Node key created and secret copied." : "Node key created.",
        variant: "success",
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  createRequestRef.current = () => {
    void handleCreate();
  };

  function dismissRenameDialog(restoreFocus: boolean) {
    setRenameState(null);

    const returnFocusTarget = renameReturnFocusRef.current;
    renameReturnFocusRef.current = null;

    if (!restoreFocus || !returnFocusTarget) {
      return;
    }

    window.requestAnimationFrame(() => {
      if (returnFocusTarget.isConnected) {
        returnFocusTarget.focus();
      }
    });
  }

  function handleStartRename(record: NodeKeyRecord) {
    if (busyAction) {
      return;
    }

    if (renameState) {
      return;
    }

    renameReturnFocusRef.current =
      typeof document !== "undefined" && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setRenameState({
      error: null,
      keyId: record.id,
      label: record.label,
    });
  }

  function handleRenameDraftChange(nextLabel: string) {
    setRenameState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        error: current.error ? validateRenameLabel(nextLabel) : null,
        label: nextLabel,
      };
    });
  }

  function handleRenameBlur() {
    setRenameState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        error: validateRenameLabel(current.label),
      };
    });
  }

  function handleRenameCancel() {
    if (renameBusy) {
      return;
    }

    dismissRenameDialog(true);
  }

  async function handleCopy(keyId: string) {
    if (busyAction || copyInFlightRef.current) {
      return;
    }
    copyInFlightRef.current = `${keyId}:secret`;

    try {
      const secretRequest = requestJson<{
        secret: string;
      }>(`/api/fugue/node-keys/${encodeURIComponent(keyId)}/secret`, {
        cache: "no-store",
      }).then((data) => data.secret);
      const copied = await copyText(secretRequest);

      showToast({
        message: copied ? "Secret copied." : "Secret is ready, but clipboard access failed.",
        variant: copied ? "success" : "info",
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      copyInFlightRef.current = null;
    }
  }

  async function handleRename(record: NodeKeyRecord) {
    if (busyAction || !renameState || renameState.keyId !== record.id) {
      return;
    }

    const error = validateRenameLabel(renameState.label);

    if (error) {
      setRenameState((current) =>
        current && current.keyId === record.id
          ? {
              ...current,
              error,
            }
          : current,
      );
      renameInputRef.current?.focus({ preventScroll: true });
      return;
    }

    const nextLabel = renameState.label.trim();

    if (nextLabel === record.label) {
      showToast({
        message: "No node key name changes.",
        variant: "info",
      });
      return;
    }

    setBusyAction(`rename:${record.id}`);

    try {
      const updated = await requestJson<{
        key: NodeKeyRecord;
      }>(`/api/fugue/node-keys/${encodeURIComponent(record.id)}`, {
        body: JSON.stringify({
          label: nextLabel,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      setKeys((current) => upsertKey(current, updated.key));
      dismissRenameDialog(true);

      showToast({
        message: "Node key name updated.",
        variant: "success",
      });
    } catch (error) {
      const message = readErrorMessage(error);

      setRenameState((current) =>
        current && current.keyId === record.id
          ? {
              ...current,
              error: message.includes("required") ? message : current.error,
            }
          : current,
      );

      showToast({
        message,
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  function handleRenameDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!renameRecord) {
      return;
    }

    if (event.key === "Escape") {
      if (renameBusy) {
        return;
      }

      event.preventDefault();
      dismissRenameDialog(true);
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusableElements = readFocusableElements(renameDialogRef.current);

    if (!focusableElements.length) {
      event.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const activeInsideDialog = activeElement
      ? renameDialogRef.current?.contains(activeElement)
      : false;

    if (event.shiftKey) {
      if (!activeInsideDialog || activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }

      return;
    }

    if (!activeInsideDialog || activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  function handleRenameBackdropPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (renameBusy) {
      renameBackdropPressStartedRef.current = false;
      return;
    }

    renameBackdropPressStartedRef.current = event.target === event.currentTarget;
  }

  function handleRenameBackdropClick(event: ReactMouseEvent<HTMLDivElement>) {
    const shouldClose =
      !renameBusy &&
      renameBackdropPressStartedRef.current &&
      event.target === event.currentTarget;

    renameBackdropPressStartedRef.current = false;

    if (!shouldClose) {
      return;
    }

    dismissRenameDialog(true);
  }

  async function handleCopyCommand(record: NodeKeyRecord) {
    if (busyAction || copyInFlightRef.current || !canUseNodeKeyForClusterJoin(record)) {
      return;
    }
    copyInFlightRef.current = `${record.id}:command`;

    try {
      const commandRequest = requestJson<{
        secret: string;
      }>(`/api/fugue/node-keys/${encodeURIComponent(record.id)}/secret`, {
        cache: "no-store",
      }).then((data) => buildJoinCommand(normalizedApiBaseUrl, data.secret));
      const copied = await copyText(commandRequest);

      showToast({
        message: copied
          ? `Cluster join command copied with ${record.label}.`
          : "Cluster join command is ready, but clipboard access failed.",
        variant: copied ? "success" : "info",
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      copyInFlightRef.current = null;
    }
  }

  async function handleRevoke(record: NodeKeyRecord) {
    if (busyAction || !record.canRevoke) {
      return;
    }

    const confirmed = await confirm({
      confirmLabel: "Revoke key",
      description:
        "Existing runtimes stay attached, but this secret can no longer enroll new nodes.",
      eyebrow: "Credential revocation",
      title: "Revoke node key?",
    });

    if (!confirmed) {
      return;
    }

    setBusyAction(`revoke:${record.id}`);

    try {
      const revoked = await requestJson<{
        key: NodeKeyRecord;
      }>(`/api/fugue/node-keys/${encodeURIComponent(record.id)}/revoke`, {
        method: "POST",
      });
      const nextKeys = removeKey(keys, revoked.key.id);

      setKeys(nextKeys);
      setSyncError(null);

      showToast({
        message: "Node key revoked and removed from the list.",
        variant: "success",
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <>
      <Panel>
        <PanelSection>
        <div className="fg-credential-section__head">
          <div className="fg-credential-section__copy">
            <strong>Node keys</strong>
            <p>Copy a join command for a VPS, or copy the raw secret if you need it.</p>
          </div>

          <div className="fg-project-actions">
            {syncError ? (
              <InlineButton
                blocked={Boolean(busyAction && busyAction !== "refresh")}
                busy={busyAction === "refresh"}
                busyLabel="Refreshing…"
                label="Refresh keys"
                onClick={() => {
                  void handleRefresh();
                }}
              />
            ) : null}

            <InlineButton
              blocked={Boolean(busyAction && busyAction !== "create")}
              busy={busyAction === "create"}
              busyLabel="Creating…"
              label="Create node key"
              onClick={() => {
                void handleCreate();
              }}
            />
          </div>
        </div>
      </PanelSection>

      <PanelSection>
        {keys.length ? (
          <div className="fg-console-table-wrap">
            <table className="fg-console-table fg-console-table--admin fg-console-table--node-keys">
              <colgroup>
                <col className="fg-console-table__col fg-console-table__col--node-key-name" />
                <col className="fg-console-table__col fg-console-table__col--node-key-prefix" />
                <col className="fg-console-table__col fg-console-table__col--node-key-status" />
                <col className="fg-console-table__col fg-console-table__col--node-key-vps" />
                <col className="fg-console-table__col fg-console-table__col--node-key-last-used" />
                <col className="fg-console-table__col fg-console-table__col--node-key-created" />
                <col className="fg-console-table__col fg-console-table__col--node-key-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Node key</th>
                  <th>Prefix</th>
                  <th>Status</th>
                  <th>Attached VPS</th>
                  <th>Last used</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((record) => {
                  const canCopyCommand = canUseNodeKeyForClusterJoin(record);
                  const status = describeStatus(record);
                  const attachedVps = describeAttachedVps(record);

                  return (
                    <tr key={record.id}>
                      <td>
                        <div
                          className="fg-console-table__pair fg-node-key-table__pair fg-node-key-table__pair--name"
                          title={`${record.label} / ${record.id}`}
                        >
                          <strong className="fg-node-key-table__label">{record.label}</strong>
                          <span className="fg-node-key-table__id">/ {record.id}</span>
                        </div>
                      </td>
                      <td>
                        {record.prefix ? (
                          <span
                            className="fg-console-table__mono fg-console-table__clip"
                            title={record.prefix}
                          >
                            {record.prefix}
                          </span>
                        ) : (
                          <span className="fg-console-tech-empty">Unavailable</span>
                        )}
                      </td>
                      <td>
                        <div className="fg-console-table__pair fg-node-key-table__pair">
                          <strong>{status.primary}</strong>
                          <span>/ {status.secondary}</span>
                        </div>
                      </td>
                      <td>
                        {attachedVps ? (
                          <div className="fg-console-table__pair fg-node-key-table__pair">
                            <strong>{attachedVps.primary}</strong>
                            <span>/ {attachedVps.secondary}</span>
                          </div>
                        ) : (
                          <span className="fg-console-tech-empty">Unavailable</span>
                        )}
                      </td>
                      <td>
                        <span title={record.lastUsedAt ?? "Never"}>{formatRelativeTime(record.lastUsedAt)}</span>
                      </td>
                      <td>
                        <span title={record.createdAt}>{formatRelativeTime(record.createdAt)}</span>
                      </td>
                      <td>
                        <div className="fg-console-toolbar fg-node-key-row__actions">
                          <InlineButton
                            blocked={Boolean(busyAction) || Boolean(renameState)}
                            label="Rename"
                            onClick={() => {
                              handleStartRename(record);
                            }}
                          />

                          <InlineButton
                            blocked={Boolean(busyAction) || Boolean(renameState)}
                            disabled={!canCopyCommand}
                            label="Copy command"
                            onClick={() => {
                              void handleCopyCommand(record);
                            }}
                          />

                          <InlineButton
                            blocked={Boolean(busyAction) || Boolean(renameState)}
                            disabled={!record.canCopy}
                            label="Copy secret"
                            onClick={() => {
                              void handleCopy(record.id);
                            }}
                          />

                          {record.canRevoke ? (
                            <InlineButton
                              blocked={Boolean(
                                renameState ||
                                  (busyAction && busyAction !== `revoke:${record.id}`),
                              )}
                              busy={busyAction === `revoke:${record.id}`}
                              busyLabel="Revoking…"
                              danger
                              label="Revoke"
                              onClick={() => {
                                void handleRevoke(record);
                              }}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="fg-api-key-empty">
            <strong>No node keys yet</strong>
            <p>Create one, then copy a join command.</p>
          </div>
        )}
        </PanelSection>
      </Panel>
      {renameRecord ? (
        <div
          className="fg-console-dialog-backdrop"
          onClick={handleRenameBackdropClick}
          onPointerDown={handleRenameBackdropPointerDown}
        >
          <div
            aria-busy={renameBusy || undefined}
            aria-describedby={renameDescriptionId}
            aria-labelledby={renameTitleId}
            aria-modal="true"
            className="fg-console-dialog-shell fg-node-key-rename-dialog-shell"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={handleRenameDialogKeyDown}
            ref={renameDialogRef}
            role="dialog"
          >
            <Panel className="fg-console-dialog-panel">
              <PanelSection>
                <p className="fg-label fg-panel__eyebrow">Node key</p>
                <PanelTitle className="fg-console-dialog__title" id={renameTitleId}>
                  Rename node key
                </PanelTitle>
                <PanelCopy id={renameDescriptionId}>
                  Update the display name used in this workspace. The key ID, secret, prefix,
                  and attached VPS stay the same.
                </PanelCopy>
                <p
                  className="fg-node-key-rename-dialog__meta"
                  title={`${renameRecord.label} / ${renameRecord.id}`}
                >
                  Current key / {renameRecord.id}
                </p>
              </PanelSection>

              <PanelSection className="fg-console-dialog__body">
                <form
                  className="fg-console-dialog__form"
                  id={renameFormId}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleRename(renameRecord);
                  }}
                >
                  <FormField
                    error={renameState?.error ?? undefined}
                    hint="Shown in this workspace only. Use a short label you can recognize later."
                    htmlFor={renameFieldId}
                    label="Node key name"
                  >
                    <input
                      autoComplete="off"
                      className="fg-input"
                      id={renameFieldId}
                      name="label"
                      onBlur={handleRenameBlur}
                      onChange={(event) => {
                        handleRenameDraftChange(event.target.value);
                      }}
                      placeholder="Primary VPS key…"
                      ref={renameInputRef}
                      spellCheck={false}
                      value={renameState?.label ?? renameRecord.label}
                    />
                  </FormField>
                </form>
              </PanelSection>

              <PanelSection className="fg-console-dialog__footer">
                <div className="fg-console-dialog__actions">
                  <Button
                    disabled={renameBusy}
                    onClick={handleRenameCancel}
                    type="button"
                    variant="secondary"
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled={Boolean(renameState?.error) || !renameChanged}
                    form={renameFormId}
                    loading={renameBusy}
                    loadingLabel="Saving…"
                    type="submit"
                    variant="primary"
                  >
                    Save name
                  </Button>
                </div>
              </PanelSection>
            </Panel>
          </div>
        </div>
      ) : null}
    </>
  );
}
