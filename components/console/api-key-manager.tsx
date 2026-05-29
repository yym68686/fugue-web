"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/providers/i18n-provider";
import { InlineButton } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { Panel, PanelSection } from "@/components/ui/panel";
import { StatusBadge } from "@/components/console/status-badge";
import { useToast } from "@/components/ui/toast";
import type { TranslationValues } from "@/lib/i18n/core";
import type { ApiKeyRecord } from "@/lib/api-keys/types";
import {
  CONSOLE_API_KEYS_PAGE_SNAPSHOT_URL,
  type ConsoleApiKeysPageSnapshot,
  readConsolePageSnapshot,
  writeConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";
import {
  getFugueScopeDescription,
  sortFugueScopes,
  WORKSPACE_ADMIN_SCOPES,
} from "@/lib/fugue/scopes";
import { copyText } from "@/lib/ui/clipboard";
import { cx } from "@/lib/ui/cx";

type ApiKeyPagePayload = {
  availableScopes: string[];
  keys: ApiKeyRecord[];
  stale: boolean;
  syncError: string | null;
  workspace: {
    adminKeyId: string;
  };
};

type Translator = (key: string, values?: TranslationValues) => string;

function readErrorMessage(error: unknown, t: Translator = (key) => key) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return t("Request failed.");
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

function buildPermissionCatalog(record: Pick<ApiKeyRecord, "isWorkspaceAdmin" | "scopes">, scopeCatalog: string[]) {
  return sortFugueScopes([
    ...(record.isWorkspaceAdmin ? WORKSPACE_ADMIN_SCOPES : []),
    ...scopeCatalog,
    ...record.scopes,
  ]);
}

type ApiKeyPermissionView = {
  catalog: string[];
  selectedScopes: Set<string>;
};

function buildPermissionViews(
  keys: ApiKeyRecord[],
  scopeCatalog: string[],
) {
  return new Map<string, ApiKeyPermissionView>(
    keys.map((record) => [
      record.id,
      {
        catalog: buildPermissionCatalog(record, scopeCatalog),
        selectedScopes: new Set(record.scopes),
      },
    ] as const),
  );
}

function sortKeys(keys: ApiKeyRecord[]) {
  const statusOrder = new Map<ApiKeyRecord["status"], number>([
    ["active", 0],
    ["disabled", 1],
    ["deleted", 2],
  ]);

  return [...keys].sort((left, right) => {
    if (left.isWorkspaceAdmin !== right.isWorkspaceAdmin) {
      return left.isWorkspaceAdmin ? -1 : 1;
    }

    const leftStatusOrder = statusOrder.get(left.status) ?? Number.MAX_SAFE_INTEGER;
    const rightStatusOrder = statusOrder.get(right.status) ?? Number.MAX_SAFE_INTEGER;

    if (leftStatusOrder !== rightStatusOrder) {
      return leftStatusOrder - rightStatusOrder;
    }

    const leftCreatedAt = Date.parse(left.createdAt);
    const rightCreatedAt = Date.parse(right.createdAt);

    if (Number.isFinite(leftCreatedAt) && Number.isFinite(rightCreatedAt) && leftCreatedAt !== rightCreatedAt) {
      return rightCreatedAt - leftCreatedAt;
    }

    return left.label.localeCompare(right.label);
  });
}

function upsertKey(keys: ApiKeyRecord[], nextKey: ApiKeyRecord) {
  return sortKeys([
    ...keys.filter((key) => key.id !== nextKey.id),
    nextKey,
  ]);
}

function applyWorkspaceAdminControls(keys: ApiKeyRecord[], workspaceAdminKeyId: string) {
  return sortKeys(
    keys.map((key) => {
      if (!key.isWorkspaceAdmin) {
        return key;
      }

      return {
        ...key,
        canDelete: key.id !== workspaceAdminKeyId && key.status !== "deleted",
        canDisable: false,
      };
    }),
  );
}

export function ApiKeyManager({
  availableScopes,
  initialKeys,
  initialSyncError,
  initialStale,
  initialWorkspaceAdminKeyId,
}: {
  availableScopes: string[];
  initialKeys: ApiKeyRecord[];
  initialSyncError: string | null;
  initialStale: boolean;
  initialWorkspaceAdminKeyId: string;
}) {
  const { formatRelativeTime, t } = useI18n();
  const confirm = useConfirmDialog();
  const { showToast } = useToast();
  const copyInFlightRef = useRef<string | null>(null);
  const didRefreshInitialStaleRef = useRef(false);
  const [keys, setKeys] = useState(() =>
    applyWorkspaceAdminControls(initialKeys, initialWorkspaceAdminKeyId),
  );
  const [scopeCatalog, setScopeCatalog] = useState(() => sortFugueScopes(availableScopes));
  const [syncError, setSyncError] = useState<string | null>(initialSyncError);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [workspaceAdminKeyId, setWorkspaceAdminKeyId] = useState(
    initialWorkspaceAdminKeyId,
  );
  const permissionViewsByKeyId = useMemo(
    () => buildPermissionViews(keys, scopeCatalog),
    [keys, scopeCatalog],
  );

  useEffect(() => {
    if (!initialSyncError) {
      return;
    }

    showToast({
      message: t("Showing stored metadata while live key sync is unavailable."),
      variant: "info",
    });
  }, [initialSyncError, showToast, t]);

  useEffect(() => {
    setKeys(applyWorkspaceAdminControls(initialKeys, initialWorkspaceAdminKeyId));
    setScopeCatalog(sortFugueScopes(availableScopes));
    setSyncError(initialSyncError);
    setWorkspaceAdminKeyId(initialWorkspaceAdminKeyId);
  }, [
    availableScopes,
    initialKeys,
    initialSyncError,
    initialWorkspaceAdminKeyId,
  ]);

  function syncLocalState(data: ApiKeyPagePayload) {
    setKeys(applyWorkspaceAdminControls(data.keys, data.workspace.adminKeyId));
    setScopeCatalog(sortFugueScopes(data.availableScopes));
    setSyncError(data.syncError);
    setWorkspaceAdminKeyId(data.workspace.adminKeyId);
    writeApiKeysPageSnapshot(data);
  }

  function writeApiKeysPageSnapshot(data: ApiKeyPagePayload) {
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
        apiKeys: data,
        state: "ready",
      },
    );
  }

  function syncApiKeysPageSnapshot(
    overrides: Partial<ApiKeyPagePayload> & {
      workspaceAdminKeyId?: string;
    },
  ) {
    writeApiKeysPageSnapshot({
      availableScopes:
        overrides.availableScopes === undefined
          ? scopeCatalog
          : sortFugueScopes(overrides.availableScopes),
      keys: overrides.keys === undefined ? keys : sortKeys(overrides.keys),
      stale: overrides.stale ?? false,
      syncError:
        overrides.syncError === undefined ? syncError : overrides.syncError,
      workspace: {
        adminKeyId:
          overrides.workspaceAdminKeyId === undefined
            ? workspaceAdminKeyId
            : overrides.workspaceAdminKeyId,
      },
    });
  }

  async function refreshKeys() {
    const data = await requestJson<ApiKeyPagePayload>("/api/fugue/api-keys", {
      cache: "no-store",
    });

    syncLocalState(data);

    return data;
  }

  useEffect(() => {
    if (!initialStale || didRefreshInitialStaleRef.current) {
      return;
    }

    didRefreshInitialStaleRef.current = true;
    void refreshKeys().catch(() => {});
  }, [initialStale]);

  async function handleRefresh() {
    if (busyAction) {
      return;
    }

    setBusyAction("refresh");

    try {
      const data = await refreshKeys();

      showToast({
        message: data.syncError
          ? t("Live sync is still unavailable. Stored metadata remains visible.")
          : t("Access key list refreshed."),
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

  async function handleCreateAdminKey() {
    if (busyAction || copyInFlightRef.current) {
      return;
    }

    setBusyAction("create-admin");

    try {
      const createRequest = requestJson<{
        key: ApiKeyRecord;
        secret: string;
      }>("/api/fugue/api-keys", {
        method: "POST",
      });
      const copiedPromise = copyText(createRequest.then((data) => data.secret));
      const created = await createRequest;
      const copied = await copiedPromise;
      const nextKeys = applyWorkspaceAdminControls(
        upsertKey(keys, created.key),
        created.key.id,
      );

      setKeys(nextKeys);
      setWorkspaceAdminKeyId(created.key.id);
      setScopeCatalog(sortFugueScopes(created.key.scopes));
      setSyncError(null);
      setExpandedId(created.key.id);
      syncApiKeysPageSnapshot({
        availableScopes: created.key.scopes,
        keys: nextKeys,
        syncError: null,
        workspaceAdminKeyId: created.key.id,
      });

      showToast({
        message: copied
          ? t("Admin key added and secret copied.")
          : t("Admin key added. Copy the new secret now."),
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

  async function handleCopy(keyId: string) {
    if (busyAction || copyInFlightRef.current) {
      return;
    }
    copyInFlightRef.current = keyId;

    try {
      const secretRequest = requestJson<{
        secret: string;
      }>(`/api/fugue/api-keys/${encodeURIComponent(keyId)}/secret`, {
        cache: "no-store",
      }).then((data) => data.secret);
      const copied = await copyText(secretRequest);

      showToast({
        message: copied
          ? t("Secret copied.")
          : t("Secret is ready, but clipboard access failed."),
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

  async function handleReplace(record: ApiKeyRecord) {
    if (busyAction) {
      return;
    }

    const confirmed = await confirm({
      confirmLabel: record.isWorkspaceAdmin
        ? t("Replace admin key")
        : t("Replace key"),
      description: record.isWorkspaceAdmin
        ? t(
            "A fresh secret will be copied for this website copy without revoking other environments.",
          )
        : t(
            "The current secret stops working immediately and the new secret will be copied.",
          ),
      eyebrow: t("Credential rotation"),
      title: record.isWorkspaceAdmin
        ? t("Replace admin key?")
        : t("Replace access key?"),
    });

    if (!confirmed) {
      return;
    }

    setBusyAction(`rotate:${record.id}`);

    try {
      const rotateRequest = requestJson<{
        key: ApiKeyRecord;
        secret: string;
      }>(`/api/fugue/api-keys/${encodeURIComponent(record.id)}/rotate`, {
        method: "POST",
      });
      const copiedPromise = copyText(rotateRequest.then((data) => data.secret));
      const rotated = await rotateRequest;
      const copied = await copiedPromise;

      if (rotated.key.isWorkspaceAdmin) {
        const nextKeys = applyWorkspaceAdminControls(
          upsertKey(keys, rotated.key),
          rotated.key.id,
        );

        setKeys(nextKeys);
        setWorkspaceAdminKeyId(rotated.key.id);
        syncApiKeysPageSnapshot({
          availableScopes: rotated.key.scopes,
          keys: nextKeys,
          syncError: null,
          workspaceAdminKeyId: rotated.key.id,
        });
      } else {
        const nextKeys = upsertKey(keys, rotated.key);

        setKeys(nextKeys);
        syncApiKeysPageSnapshot({
          keys: nextKeys,
          syncError: null,
        });
      }
      if (rotated.key.isWorkspaceAdmin) {
        setScopeCatalog(sortFugueScopes(rotated.key.scopes));
      }
      setSyncError(null);
      setExpandedId(rotated.key.id);

      showToast({
        message: copied
          ? record.isWorkspaceAdmin
            ? t("Admin key replaced for this website copy and secret copied.")
            : t(
                "Access key replaced and secret copied. The previous secret no longer works.",
              )
          : record.isWorkspaceAdmin
            ? t("Admin key replaced for this website copy. Copy the new secret now.")
            : t("Access key replaced. Copy the new secret now."),
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

  async function handleDelete(record: ApiKeyRecord) {
    if (busyAction || !record.canDelete) {
      return;
    }

    const confirmed = await confirm({
      confirmLabel: t("Delete key"),
      description: t("This revokes the secret in Fugue immediately."),
      title: t("Delete access key?"),
    });

    if (!confirmed) {
      return;
    }

    setBusyAction(`delete:${record.id}`);

    try {
      await requestJson<{
        key: ApiKeyRecord;
      }>(`/api/fugue/api-keys/${encodeURIComponent(record.id)}`, {
        method: "DELETE",
      });

      const nextKeys = keys.filter((key) => key.id !== record.id);

      setKeys(nextKeys);
      setSyncError(null);
      setExpandedId((current) => (current === record.id ? null : current));
      syncApiKeysPageSnapshot({
        keys: nextKeys,
        syncError: null,
      });

      showToast({
        message: t("Key deleted."),
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

  async function handleStatusToggle(record: ApiKeyRecord) {
    if (busyAction || !record.canDisable) {
      return;
    }

    const nextAction = record.status === "disabled" ? "enable" : "disable";
    setBusyAction(`${nextAction}:${record.id}`);

    try {
      const updated = await requestJson<{
        key: ApiKeyRecord;
      }>(`/api/fugue/api-keys/${encodeURIComponent(record.id)}/${nextAction}`, {
        method: "POST",
      });

      const nextKeys = upsertKey(keys, updated.key);

      setKeys(nextKeys);
      setSyncError(null);
      setExpandedId(updated.key.id);
      syncApiKeysPageSnapshot({
        keys: nextKeys,
        syncError: null,
      });

      showToast({
        message: nextAction === "enable" ? t("Key restored.") : t("Key disabled."),
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

  async function handleScopeToggle(record: ApiKeyRecord, scope: string) {
    if (busyAction) {
      return;
    }

    const selectedScopes = new Set(record.scopes);
    const hasScope = selectedScopes.has(scope);
    const nextScopes = hasScope
      ? record.scopes.filter((item) => item !== scope)
      : sortFugueScopes([...record.scopes, scope]);

    if (!nextScopes.length) {
      showToast({
        message: t("Keep at least one permission enabled."),
        variant: "error",
      });
      return;
    }

    setKeys((current) =>
      current.map((key) =>
        key.id === record.id
          ? {
              ...key,
              scopes: nextScopes,
            }
          : key,
      ),
    );
    setBusyAction(`scope:${record.id}:${scope}`);

    try {
      const updated = await requestJson<{
        key: ApiKeyRecord;
      }>(`/api/fugue/api-keys/${encodeURIComponent(record.id)}`, {
        body: JSON.stringify({
          scopes: nextScopes,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      const nextKeys = upsertKey(keys, updated.key);

      setKeys(nextKeys);
      if (updated.key.isWorkspaceAdmin && updated.key.id === workspaceAdminKeyId) {
        setScopeCatalog(sortFugueScopes(updated.key.scopes));
      }
      setSyncError(null);
      setExpandedId(updated.key.id);
      syncApiKeysPageSnapshot({
        availableScopes: updated.key.isWorkspaceAdmin && updated.key.id === workspaceAdminKeyId
          ? updated.key.scopes
          : scopeCatalog,
        keys: nextKeys,
        syncError: null,
      });

      showToast({
        message: t("Permissions updated."),
        variant: "success",
      });
    } catch (error) {
      setKeys((current) =>
        current.map((key) =>
          key.id === record.id
            ? {
                ...key,
                scopes: record.scopes,
              }
            : key,
        ),
      );
      showToast({
        message: readErrorMessage(error, t),
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <Panel>
      <PanelSection>
        <div className="fg-credential-section__head">
          <div className="fg-credential-section__copy">
            <strong>{t("Admin keys")}</strong>
            <p>{t("Add a workspace admin key for another environment, or copy a stored secret.")}</p>
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
              blocked={Boolean(busyAction && busyAction !== "create-admin")}
              busy={busyAction === "create-admin"}
              busyLabel={t("Creating…")}
              label={t("Add admin key")}
              onClick={() => {
                void handleCreateAdminKey();
              }}
            />
          </div>
        </div>
      </PanelSection>

      <PanelSection>
        {keys.length ? (
          <div className="fg-api-key-list">
            {keys.map((record) => {
              const expanded = expandedId === record.id;
              const isCurrentWorkspaceAdmin =
                record.isWorkspaceAdmin && record.id === workspaceAdminKeyId;
              const permissionView =
                permissionViewsByKeyId.get(record.id) ??
                ({
                  catalog: buildPermissionCatalog(record, scopeCatalog),
                  selectedScopes: new Set(record.scopes),
                } satisfies ApiKeyPermissionView);

              return (
                <article
                  className={cx(
                    "fg-api-key-item",
                    expanded && "is-expanded",
                  )}
                  key={record.id}
                >
                  <div className="fg-api-key-item__summary">
                    <button
                      aria-expanded={expanded}
                      className="fg-api-key-item__summary-toggle"
                      onClick={() => {
                        setExpandedId((current) =>
                          current === record.id ? null : record.id,
                        );
                      }}
                      type="button"
                    />

                    <div className="fg-api-key-item__toggle">
                      <div className="fg-api-key-item__title">
                        <strong>
                          {record.isWorkspaceAdmin
                            ? t("Admin key")
                            : record.label}
                        </strong>
                        {isCurrentWorkspaceAdmin ? (
                          <StatusBadge tone="info">{t("Current key")}</StatusBadge>
                        ) : null}
                      </div>

                      <p className="fg-api-key-item__meta">
                        {t(
                          record.scopes.length === 1
                            ? "{count} permission"
                            : "{count} permissions",
                          {
                            count: record.scopes.length,
                          },
                        )}{" "}
                        · {record.status === "disabled" ? `${t("disabled")} · ` : ""}
                        {t("last used")} {formatRelativeTime(record.lastUsedAt, { notYetText: t("Never") })}
                      </p>
                    </div>

                    <div className="fg-api-key-item__actions">
                      <InlineButton
                        blocked={Boolean(
                          busyAction && busyAction !== `rotate:${record.id}`,
                        )}
                        busy={busyAction === `rotate:${record.id}`}
                        busyLabel={
                          record.isWorkspaceAdmin ? t("Replacing…") : t("Rotating…")
                        }
                        className="fg-api-key-item__action"
                        label={record.isWorkspaceAdmin ? t("Replace") : t("Rotate")}
                        onClick={() => {
                          void handleReplace(record);
                        }}
                      />

                      <InlineButton
                        blocked={Boolean(busyAction)}
                        className="fg-api-key-item__action"
                        disabled={!record.canCopy}
                        label={t("Copy")}
                        onClick={() => {
                          void handleCopy(record.id);
                        }}
                      />

                      {record.canDisable ? (
                        <InlineButton
                          blocked={Boolean(
                            busyAction &&
                              busyAction !== `disable:${record.id}` &&
                              busyAction !== `enable:${record.id}`,
                          )}
                          busy={
                            busyAction === `disable:${record.id}` ||
                            busyAction === `enable:${record.id}`
                          }
                          busyLabel={
                            record.status === "disabled"
                              ? t("Restoring…")
                              : t("Disabling…")
                          }
                          className="fg-api-key-item__action"
                          label={
                            record.status === "disabled"
                              ? t("Restore")
                              : t("Disable")
                          }
                          onClick={() => {
                            void handleStatusToggle(record);
                          }}
                        />
                      ) : null}

                      {record.canDelete ? (
                        <InlineButton
                          blocked={Boolean(
                            busyAction && busyAction !== `delete:${record.id}`,
                          )}
                          busy={busyAction === `delete:${record.id}`}
                          busyLabel={t("Deleting…")}
                          className="fg-api-key-item__action"
                          danger
                          label={t("Delete")}
                          onClick={() => {
                            void handleDelete(record);
                          }}
                        />
                      ) : null}
                    </div>
                  </div>

                  {expanded ? (
                    <div className="fg-api-key-item__panel">
                      <div className="fg-api-key-item__details">
                        <dl className="fg-api-key-facts">
                          <div>
                            <dt>{t("Identifier")}</dt>
                            <dd>{record.id}</dd>
                          </div>
                          <div>
                            <dt>{t("Prefix")}</dt>
                            <dd>{record.prefix ?? t("Unavailable")}</dd>
                          </div>
                          <div>
                            <dt>{t("Created")}</dt>
                            <dd>
                              {formatRelativeTime(record.createdAt, {
                                notYetText: t("Never"),
                              })}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <div className="fg-api-key-permissions">
                        <div className="fg-api-key-permissions__head">
                          <div>
                            <strong>{t("Permissions")}</strong>
                            <p>{t("Changes apply immediately.")}</p>
                          </div>

                          <span className="fg-api-key-permissions__count">
                            {record.scopes.length}/{permissionView.catalog.length || record.scopes.length}
                          </span>
                        </div>

                        {permissionView.catalog.length ? (
                          <div className="fg-api-key-permission-grid">
                            {permissionView.catalog.map((scope) => {
                              const selected = permissionView.selectedScopes.has(scope);

                              return (
                                <label
                                  className={cx(
                                    "fg-api-key-permission",
                                    selected && "is-selected",
                                  )}
                                  key={`${record.id}:${scope}`}
                                >
                                  <input
                                    checked={selected}
                                    className="fg-api-key-permission__input"
                                    disabled={busyAction !== null}
                                    onChange={() => {
                                      void handleScopeToggle(record, scope);
                                    }}
                                    type="checkbox"
                                  />

                                  <span className="fg-api-key-permission__row">
                                    <strong>{scope}</strong>
                                    <span>{selected ? t("On") : t("Off")}</span>
                                  </span>

                                  <span className="fg-api-key-permission__copy">
                                    {t(getFugueScopeDescription(scope))}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="fg-api-key-permissions__empty">
                            {t(
                              "No permissions are currently available from the workspace key.",
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="fg-api-key-empty">
            <strong>{t("Admin key unavailable")}</strong>
            <p>{t("Restore the workspace to continue.")}</p>
          </div>
        )}
      </PanelSection>
    </Panel>
  );
}
