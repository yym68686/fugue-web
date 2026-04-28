"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { useI18n } from "@/components/providers/i18n-provider";
import { Button, InlineButton } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import type { TranslationValues } from "@/lib/i18n/core";
import {
  CONSOLE_API_KEYS_PAGE_SNAPSHOT_URL,
  type ConsoleApiKeysPageSnapshot,
  readConsolePageSnapshot,
  writeConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";
import { NODE_KEY_CREATE_REQUEST_EVENT } from "@/lib/console/events";
import {
  canUseNodeKeyForClusterJoin,
  sortNodeKeys,
} from "@/lib/node-keys/selection";
import type { NodeKeyRecord } from "@/lib/node-keys/types";
import { copyText } from "@/lib/ui/clipboard";
import { cx } from "@/lib/ui/cx";
import { useTransitionPresence } from "@/lib/ui/transition-presence";

type NodeKeyPagePayload = {
  keys: NodeKeyRecord[];
  stale: boolean;
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

type Translator = (key: string, values?: TranslationValues) => string;

function readErrorMessage(error: unknown, t: Translator = (key) => key) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return t("Request failed.");
}

function validateRenameLabel(label: string, t: Translator = (key) => key) {
  if (!label.trim()) {
    return t("Node key name is required.");
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
  const { formatRelativeTime, t } = useI18n();
  const confirm = useConfirmDialog();
  const { showToast } = useToast();
  const createRequestRef = useRef<() => void>(() => {});
  const copyInFlightRef = useRef<string | null>(null);
  const renameDialogRef = useRef<HTMLDivElement | null>(null);
  const renameBackdropPressStartedRef = useRef(false);
  const renameReturnFocusRef = useRef<HTMLElement | null>(null);
  const renameRestoreFocusAfterCloseRef = useRef(false);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const normalizedApiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
  const [keys, setKeys] = useState(() => sortNodeKeys(initialKeys));
  const [syncError, setSyncError] = useState<string | null>(initialSyncError);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [renameState, setRenameState] = useState<RenameState | null>(null);
  const renameDialog = useTransitionPresence({
    closePropertyName: "--modal-close-dur",
    fallbackCloseMs: 150,
  });
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
      message: t("Showing stored node key metadata while live sync is unavailable."),
      variant: "info",
    });
  }, [initialSyncError, showToast, t]);

  useEffect(() => {
    setKeys(sortNodeKeys(initialKeys));
    setSyncError(initialSyncError);
  }, [initialKeys, initialSyncError]);

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
    if (!renameDialog.present) {
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

    return () => {
      renameBackdropPressStartedRef.current = false;
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [renameDialog.present]);

  useEffect(() => {
    if (!renameDialog.open || !renameRecord) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const input = renameInputRef.current;

      input?.focus({ preventScroll: true });
      input?.select();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [renameDialog.open, renameRecord]);

  useEffect(() => {
    if (renameDialog.present || !renameState) {
      return;
    }

    setRenameState(null);

    const returnFocusTarget = renameReturnFocusRef.current;
    renameReturnFocusRef.current = null;

    if (!renameRestoreFocusAfterCloseRef.current || !returnFocusTarget) {
      renameRestoreFocusAfterCloseRef.current = false;
      return;
    }

    renameRestoreFocusAfterCloseRef.current = false;

    window.requestAnimationFrame(() => {
      if (returnFocusTarget.isConnected) {
        returnFocusTarget.focus();
      }
    });
  }, [renameDialog.present, renameState]);

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
    writeNodeKeysPageSnapshot(data);
  }

  function writeNodeKeysPageSnapshot(data: NodeKeyPagePayload) {
    const currentSnapshot = readConsolePageSnapshot<ConsoleApiKeysPageSnapshot>(
      CONSOLE_API_KEYS_PAGE_SNAPSHOT_URL,
      {
        allowStale: true,
      },
    );

    if (!currentSnapshot || currentSnapshot.state !== "ready") {
      return;
    }

    writeConsolePageSnapshot<ConsoleApiKeysPageSnapshot>(
      CONSOLE_API_KEYS_PAGE_SNAPSHOT_URL,
      {
        ...currentSnapshot,
        nodeKeys: data,
        state: "ready",
      },
    );
  }

  function syncNodeKeysPageSnapshot(overrides: Partial<NodeKeyPagePayload>) {
    writeNodeKeysPageSnapshot({
      keys: overrides.keys === undefined ? keys : sortNodeKeys(overrides.keys),
      stale: overrides.stale ?? false,
      syncError:
        overrides.syncError === undefined ? syncError : overrides.syncError,
    });
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
          ? t("Live sync is still unavailable. Stored node key metadata remains visible.")
          : t("Node key list refreshed."),
        variant: data.syncError ? "info" : "success",
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error, t),
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
      syncNodeKeysPageSnapshot({
        keys: nextKeys,
        syncError: null,
      });

      showToast({
        message: copied ? t("Node key created and secret copied.") : t("Node key created."),
        variant: "success",
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error, t),
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
    renameRestoreFocusAfterCloseRef.current = restoreFocus;
    renameDialog.close();
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
    renameDialog.openPresence();
  }

  function handleRenameDraftChange(nextLabel: string) {
    setRenameState((current) => {
      if (!current) {
        return current;
      }

        return {
          ...current,
          error: current.error ? validateRenameLabel(nextLabel, t) : null,
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
        error: validateRenameLabel(current.label, t),
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
        message: copied ? t("Secret copied.") : t("Secret is ready, but clipboard access failed."),
        variant: copied ? "success" : "info",
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error, t),
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

    const error = validateRenameLabel(renameState.label, t);

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
        message: t("No node key name changes."),
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

      const nextKeys = upsertKey(keys, updated.key);

      setKeys(nextKeys);
      syncNodeKeysPageSnapshot({
        keys: nextKeys,
      });
      dismissRenameDialog(true);

      showToast({
        message: t("Node key name updated."),
        variant: "success",
      });
    } catch (error) {
      const message = readErrorMessage(error, t);

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
          ? t("Cluster join command copied with {label}.", {
              label: record.label,
            })
          : t("Cluster join command is ready, but clipboard access failed."),
        variant: copied ? "success" : "info",
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error, t),
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
      confirmLabel: t("Revoke key"),
      description:
        t("Existing runtimes stay attached, but this secret can no longer enroll new nodes."),
      eyebrow: t("Credential revocation"),
      title: t("Revoke node key?"),
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
      syncNodeKeysPageSnapshot({
        keys: nextKeys,
        syncError: null,
      });

      showToast({
        message: t("Node key revoked and removed from the list."),
        variant: "success",
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error, t),
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
            <strong>{t("Node keys")}</strong>
            <p>{t("Copy a join command for a VPS, or copy the raw secret if you need it.")}</p>
          </div>

          <div className="fg-project-actions">
            {syncError ? (
              <InlineButton
                blocked={Boolean(busyAction && busyAction !== "refresh")}
                busy={busyAction === "refresh"}
                busyLabel={t("Refreshing…")}
                label={t("Refresh keys")}
                onClick={() => {
                  void handleRefresh();
                }}
              />
            ) : null}

            <InlineButton
              blocked={Boolean(busyAction && busyAction !== "create")}
              busy={busyAction === "create"}
              busyLabel={t("Creating…")}
              label={t("Create node key")}
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
                  <th>{t("Node key")}</th>
                  <th>{t("Prefix")}</th>
                  <th>{t("Status")}</th>
                  <th>{t("Attached VPS")}</th>
                  <th>{t("Last used")}</th>
                  <th>{t("Created")}</th>
                  <th>{t("Actions")}</th>
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
                          <span className="fg-console-tech-empty">{t("Unavailable")}</span>
                        )}
                      </td>
                      <td>
                        <div className="fg-console-table__pair fg-node-key-table__pair">
                          <strong>{t(status.primary)}</strong>
                          <span>/ {t(status.secondary)}</span>
                        </div>
                      </td>
                      <td>
                        {attachedVps ? (
                          <div className="fg-console-table__pair fg-node-key-table__pair">
                            <strong>{attachedVps.primary}</strong>
                            <span>/ {t(attachedVps.secondary)}</span>
                          </div>
                        ) : (
                          <span className="fg-console-tech-empty">{t("Unavailable")}</span>
                        )}
                      </td>
                      <td>
                        <span title={record.lastUsedAt ?? t("Never")}>
                          {formatRelativeTime(record.lastUsedAt, {
                            notYetText: t("Never"),
                          })}
                        </span>
                      </td>
                      <td>
                        <span title={record.createdAt}>
                          {formatRelativeTime(record.createdAt, {
                            notYetText: t("Never"),
                          })}
                        </span>
                      </td>
                      <td>
                        <div className="fg-console-toolbar fg-node-key-row__actions">
                          <InlineButton
                            blocked={Boolean(busyAction) || Boolean(renameState)}
                            label={t("Rename")}
                            onClick={() => {
                              handleStartRename(record);
                            }}
                          />

                          <InlineButton
                            blocked={Boolean(busyAction) || Boolean(renameState)}
                            disabled={!canCopyCommand}
                            label={t("Copy command")}
                            onClick={() => {
                              void handleCopyCommand(record);
                            }}
                          />

                          <InlineButton
                            blocked={Boolean(busyAction) || Boolean(renameState)}
                            disabled={!record.canCopy}
                            label={t("Copy secret")}
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
                              busyLabel={t("Revoking…")}
                              danger
                              label={t("Revoke")}
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
            <strong>{t("No node keys yet")}</strong>
            <p>{t("Create one, then copy a join command.")}</p>
          </div>
        )}
        </PanelSection>
      </Panel>
      {renameDialog.present && renameRecord ? (
        <div
          className="fg-console-dialog-backdrop"
          data-state={renameDialog.closing ? "closing" : "open"}
          onClick={handleRenameBackdropClick}
          onPointerDown={handleRenameBackdropPointerDown}
        >
          <div
            aria-busy={renameBusy || undefined}
            aria-describedby={renameDescriptionId}
            aria-labelledby={renameTitleId}
            aria-modal="true"
            className={cx(
              "fg-console-dialog-shell fg-node-key-rename-dialog-shell",
              "t-modal",
              renameDialog.open && "is-open",
              renameDialog.closing && "is-closing",
            )}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={handleRenameDialogKeyDown}
            ref={renameDialogRef}
            role="dialog"
          >
            <Panel className="fg-console-dialog-panel">
              <PanelSection>
                <p className="fg-label fg-panel__eyebrow">{t("Node key")}</p>
                <PanelTitle className="fg-console-dialog__title" id={renameTitleId}>
                  {t("Rename node key")}
                </PanelTitle>
                <PanelCopy id={renameDescriptionId}>
                  {t(
                    "Update the display name used in this workspace. The key ID, secret, prefix, and attached VPS stay the same.",
                  )}
                </PanelCopy>
                <p
                  className="fg-node-key-rename-dialog__meta"
                  title={`${renameRecord.label} / ${renameRecord.id}`}
                >
                  {t("Current key")} / {renameRecord.id}
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
                    hint={t(
                      "Shown in this workspace only. Use a short label you can recognize later.",
                    )}
                    htmlFor={renameFieldId}
                    label={t("Node key name")}
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
                      placeholder={t("Primary VPS key…")}
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
                    {t("Cancel")}
                  </Button>
                  <Button
                    disabled={Boolean(renameState?.error) || !renameChanged}
                    form={renameFormId}
                    loading={renameBusy}
                    loadingLabel={t("Saving…")}
                    type="submit"
                    variant="primary"
                  >
                    {t("Save name")}
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
