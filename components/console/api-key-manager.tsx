"use client";

import { useEffect, useState } from "react";

import { Panel, PanelSection } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import type { ApiKeyRecord } from "@/lib/api-keys/types";
import {
  getFugueScopeDescription,
  sortFugueScopes,
  WORKSPACE_ADMIN_SCOPES,
} from "@/lib/fugue/scopes";
import { cx } from "@/lib/ui/cx";

type ApiKeyPagePayload = {
  availableScopes: string[];
  keys: ApiKeyRecord[];
  syncError: string | null;
  workspace: {
    adminKeyId: string;
  };
};

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Request failed.";
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

async function copyText(value: string) {
  if (!navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
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

function buildPermissionCatalog(record: Pick<ApiKeyRecord, "isWorkspaceAdmin" | "scopes">, scopeCatalog: string[]) {
  return sortFugueScopes([
    ...(record.isWorkspaceAdmin ? WORKSPACE_ADMIN_SCOPES : []),
    ...scopeCatalog,
    ...record.scopes,
  ]);
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

function InlineActionButton({
  blocked = false,
  busy = false,
  className,
  disabled = false,
  label,
  onClick,
}: {
  blocked?: boolean;
  busy?: boolean;
  className?: string;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-busy={busy || undefined}
      aria-disabled={blocked || undefined}
      className={cx(
        "fg-console-inline-action",
        "fg-api-key-item__action",
        className,
        busy && "is-busy",
        blocked && "is-blocked",
      )}
      disabled={disabled || busy}
      onClick={() => {
        if (blocked || busy || disabled) {
          return;
        }

        onClick();
      }}
      tabIndex={blocked ? -1 : undefined}
      type="button"
    >
      <span aria-hidden="true" className="fg-console-inline-action__status" />
      <span className="fg-console-inline-action__label">{label}</span>
    </button>
  );
}

export function ApiKeyManager({
  availableScopes,
  initialKeys,
  initialSyncError,
}: {
  availableScopes: string[];
  initialKeys: ApiKeyRecord[];
  initialSyncError: string | null;
}) {
  const { showToast } = useToast();
  const [keys, setKeys] = useState(initialKeys);
  const [scopeCatalog, setScopeCatalog] = useState(() => sortFugueScopes(availableScopes));
  const [syncError, setSyncError] = useState<string | null>(initialSyncError);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    if (!initialSyncError) {
      return;
    }

    showToast({
      message: "Showing stored metadata while live key sync is unavailable.",
      variant: "info",
    });
  }, [initialSyncError, showToast]);

  function syncLocalState(data: ApiKeyPagePayload) {
    setKeys(sortKeys(data.keys));
    setScopeCatalog(sortFugueScopes(data.availableScopes));
    setSyncError(data.syncError);
  }

  async function refreshKeys() {
    const data = await requestJson<ApiKeyPagePayload>("/api/fugue/api-keys", {
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
          ? "Live sync is still unavailable. Stored metadata remains visible."
          : "API key list refreshed.",
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

  async function handleCopy(keyId: string) {
    if (busyAction) {
      return;
    }

    setBusyAction(`copy:${keyId}`);

    try {
      const data = await requestJson<{
        secret: string;
      }>(`/api/fugue/api-keys/${encodeURIComponent(keyId)}/secret`, {
        cache: "no-store",
      });

      const copied = await copyText(data.secret);

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
      setBusyAction(null);
    }
  }

  async function handleReplace(record: ApiKeyRecord) {
    if (busyAction) {
      return;
    }

    const confirmed = window.confirm(
      record.isWorkspaceAdmin
        ? "Replace this admin key? The current secret stops working immediately and the new secret will be copied."
        : "Replace this API key? The current secret stops working immediately and the new secret will be copied.",
    );

    if (!confirmed) {
      return;
    }

    setBusyAction(`rotate:${record.id}`);

    try {
      const rotated = await requestJson<{
        key: ApiKeyRecord;
        secret: string;
      }>(`/api/fugue/api-keys/${encodeURIComponent(record.id)}/rotate`, {
        method: "POST",
      });
      const copied = await copyText(rotated.secret);

      setKeys((current) => upsertKey(current, rotated.key));
      if (rotated.key.isWorkspaceAdmin) {
        setScopeCatalog(sortFugueScopes(rotated.key.scopes));
      }
      setSyncError(null);
      setExpandedId(rotated.key.id);

      showToast({
        message: copied
          ? record.isWorkspaceAdmin
            ? "Admin key replaced and secret copied. The previous secret no longer works."
            : "API key replaced and secret copied. The previous secret no longer works."
          : record.isWorkspaceAdmin
            ? "Admin key replaced. Copy the new secret now."
            : "API key replaced. Copy the new secret now.",
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

  async function handleDelete(record: ApiKeyRecord) {
    if (busyAction || !record.canDelete) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this API key? This revokes the secret in Fugue immediately.",
    );

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

      setKeys((current) => current.filter((key) => key.id !== record.id));
      setSyncError(null);
      setExpandedId((current) => (current === record.id ? null : current));

      showToast({
        message: "Key deleted.",
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

      setKeys((current) => upsertKey(current, updated.key));
      setSyncError(null);
      setExpandedId(updated.key.id);

      showToast({
        message: nextAction === "enable" ? "Key restored." : "Key disabled.",
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

  async function handleScopeToggle(record: ApiKeyRecord, scope: string) {
    if (busyAction) {
      return;
    }

    const permissionCatalog = buildPermissionCatalog(record, scopeCatalog);
    const hasScope = record.scopes.includes(scope);
    const nextScopes = hasScope
      ? record.scopes.filter((item) => item !== scope)
      : sortFugueScopes([...record.scopes, scope]);

    if (!nextScopes.length) {
      showToast({
        message: "Keep at least one permission enabled.",
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

      setKeys((current) => upsertKey(current, updated.key));
      if (updated.key.isWorkspaceAdmin) {
        setScopeCatalog(sortFugueScopes(updated.key.scopes));
      }
      setSyncError(null);
      setExpandedId(updated.key.id);

      showToast({
        message: "Permissions updated.",
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
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <Panel>
      {syncError ? (
        <PanelSection>
          <div className="fg-project-actions">
            <InlineActionButton
              blocked={Boolean(busyAction && busyAction !== "refresh")}
              busy={busyAction === "refresh"}
              label={busyAction === "refresh" ? "Refreshing…" : "Refresh keys"}
              onClick={() => {
                void handleRefresh();
              }}
            />
          </div>
        </PanelSection>
      ) : null}

      <PanelSection>
        {keys.length ? (
          <div className="fg-api-key-list">
            {keys.map((record) => {
              const expanded = expandedId === record.id;
              const permissionCatalog = buildPermissionCatalog(record, scopeCatalog);

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
                            ? "Admin key"
                            : record.label}
                        </strong>
                      </div>

                      <p className="fg-api-key-item__meta">
                        {record.scopes.length} permission
                        {record.scopes.length === 1 ? "" : "s"} ·{" "}
                        {record.status === "disabled" ? "disabled · " : ""}
                        last used{" "}
                        {formatRelativeTime(record.lastUsedAt)}
                      </p>
                    </div>

                    <div className="fg-api-key-item__actions">
                      <InlineActionButton
                        blocked={Boolean(
                          busyAction && busyAction !== `rotate:${record.id}`,
                        )}
                        busy={busyAction === `rotate:${record.id}`}
                        label={record.isWorkspaceAdmin ? "Replace" : "Rotate"}
                        onClick={() => {
                          void handleReplace(record);
                        }}
                      />

                      <InlineActionButton
                        blocked={Boolean(
                          busyAction && busyAction !== `copy:${record.id}`,
                        )}
                        busy={busyAction === `copy:${record.id}`}
                        disabled={!record.canCopy}
                        label="Copy"
                        onClick={() => {
                          void handleCopy(record.id);
                        }}
                      />

                      {record.canDisable ? (
                        <InlineActionButton
                          blocked={Boolean(
                            busyAction &&
                              busyAction !== `disable:${record.id}` &&
                              busyAction !== `enable:${record.id}`,
                          )}
                          busy={
                            busyAction === `disable:${record.id}` ||
                            busyAction === `enable:${record.id}`
                          }
                          label={record.status === "disabled" ? "Restore" : "Disable"}
                          onClick={() => {
                            void handleStatusToggle(record);
                          }}
                        />
                      ) : null}

                      {record.canDelete ? (
                        <InlineActionButton
                          blocked={Boolean(
                            busyAction && busyAction !== `delete:${record.id}`,
                          )}
                          busy={busyAction === `delete:${record.id}`}
                          className="is-danger"
                          label="Delete"
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
                            <dt>ID</dt>
                            <dd>{record.id}</dd>
                          </div>
                          <div>
                            <dt>Prefix</dt>
                            <dd>{record.prefix ?? "Unavailable"}</dd>
                          </div>
                          <div>
                            <dt>Created</dt>
                            <dd>{formatRelativeTime(record.createdAt)}</dd>
                          </div>
                        </dl>
                      </div>

                      <div className="fg-api-key-permissions">
                        <div className="fg-api-key-permissions__head">
                          <div>
                            <strong>Permissions</strong>
                            <p>Changes apply immediately.</p>
                          </div>

                          <span className="fg-api-key-permissions__count">
                            {record.scopes.length}/{permissionCatalog.length || record.scopes.length}
                          </span>
                        </div>

                        {permissionCatalog.length ? (
                          <div className="fg-api-key-permission-grid">
                            {permissionCatalog.map((scope) => {
                              const selected = record.scopes.includes(scope);

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
                                    <span>{selected ? "On" : "Off"}</span>
                                  </span>

                                  <span className="fg-api-key-permission__copy">
                                    {getFugueScopeDescription(scope)}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="fg-api-key-permissions__empty">
                            No permissions are currently available from the workspace key.
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
            <strong>Admin key unavailable</strong>
            <p>Restore the workspace to continue.</p>
          </div>
        )}
      </PanelSection>
    </Panel>
  );
}
