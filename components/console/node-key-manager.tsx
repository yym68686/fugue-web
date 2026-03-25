"use client";

import { useEffect, useRef, useState } from "react";

import { Panel, PanelSection } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import { NODE_KEY_CREATE_REQUEST_EVENT } from "@/lib/console/events";
import type { NodeKeyRecord } from "@/lib/node-keys/types";
import { cx } from "@/lib/ui/cx";

type NodeKeyPagePayload = {
  keys: NodeKeyRecord[];
  syncError: string | null;
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

function sortKeys(keys: NodeKeyRecord[]) {
  const statusOrder = new Map<NodeKeyRecord["status"], number>([
    ["active", 0],
    ["revoked", 1],
  ]);

  return [...keys].sort((left, right) => {
    const leftStatusOrder = statusOrder.get(left.status) ?? Number.MAX_SAFE_INTEGER;
    const rightStatusOrder = statusOrder.get(right.status) ?? Number.MAX_SAFE_INTEGER;

    if (leftStatusOrder !== rightStatusOrder) {
      return leftStatusOrder - rightStatusOrder;
    }

    const leftCreatedAt = Date.parse(left.createdAt);
    const rightCreatedAt = Date.parse(right.createdAt);

    if (
      Number.isFinite(leftCreatedAt) &&
      Number.isFinite(rightCreatedAt) &&
      leftCreatedAt !== rightCreatedAt
    ) {
      return rightCreatedAt - leftCreatedAt;
    }

    return left.label.localeCompare(right.label);
  });
}

function upsertKey(keys: NodeKeyRecord[], nextKey: NodeKeyRecord) {
  return sortKeys([
    ...keys.filter((key) => key.id !== nextKey.id),
    nextKey,
  ]);
}

function removeKey(keys: NodeKeyRecord[], keyId: string) {
  return sortKeys(keys.filter((key) => key.id !== keyId));
}

function InlineActionButton({
  blocked = false,
  busy = false,
  className,
  label,
  onClick,
}: {
  blocked?: boolean;
  busy?: boolean;
  className?: string;
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
      disabled={busy}
      onClick={() => {
        if (busy || blocked) {
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

export function NodeKeyManager({
  initialKeys,
  initialSyncError,
}: {
  initialKeys: NodeKeyRecord[];
  initialSyncError: string | null;
}) {
  const { showToast } = useToast();
  const createRequestRef = useRef<() => void>(() => {});
  const [keys, setKeys] = useState(() => sortKeys(initialKeys));
  const [syncError, setSyncError] = useState<string | null>(initialSyncError);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

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

  function syncLocalState(data: NodeKeyPagePayload) {
    setKeys(sortKeys(data.keys));
    setSyncError(data.syncError);
  }

  async function refreshKeys(options?: { successMessage?: string }) {
    const data = await requestJson<NodeKeyPagePayload>("/api/fugue/node-keys", {
      cache: "no-store",
    });

    syncLocalState(data);

    if (options?.successMessage) {
      showToast({
        message: options.successMessage,
        variant: "success",
      });
    } else if (data.syncError) {
      showToast({
        message: "Showing stored node key metadata while live sync is unavailable.",
        variant: "info",
      });
    }

    return data;
  }

  async function handleRefresh() {
    if (busyAction) {
      return;
    }

    setBusyAction("refresh");

    try {
      const data = await refreshKeys({
        successMessage: "Node key list refreshed.",
      });

      if (data.syncError) {
        showToast({
          message: "Live sync is still unavailable. Stored node key metadata remains visible.",
          variant: "info",
        });
      }
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
      const created = await requestJson<{
        key: NodeKeyRecord;
        secret: string;
      }>("/api/fugue/node-keys", {
        method: "POST",
      });
      const copied = await copyText(created.secret);

      setKeys((current) => upsertKey(current, created.key));
      setSyncError(null);
      setExpandedId(created.key.id);

      showToast({
        message: copied
          ? "Node key created and secret copied."
          : "Node key created.",
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

  async function handleCopy(keyId: string) {
    if (busyAction) {
      return;
    }

    setBusyAction(`copy:${keyId}`);

    try {
      const data = await requestJson<{
        secret: string;
      }>(`/api/fugue/node-keys/${encodeURIComponent(keyId)}/secret`, {
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

  async function handleRevoke(record: NodeKeyRecord) {
    if (busyAction || !record.canRevoke) {
      return;
    }

    const confirmed = window.confirm(
      "Revoke this node key? Existing runtimes stay attached, but this secret can no longer enroll new nodes.",
    );

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

      setKeys((current) => removeKey(current, revoked.key.id));
      setSyncError(null);
      setExpandedId((current) => (current === revoked.key.id ? null : current));

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
    <Panel>
      <PanelSection>
        <div className="fg-credential-section__head">
          <div className="fg-credential-section__copy">
            <strong>Node keys</strong>
            <p>Reusable secrets for attaching external runtimes.</p>
          </div>

          <InlineActionButton
            blocked={Boolean(busyAction && busyAction !== "create")}
            busy={busyAction === "create"}
            label={busyAction === "create" ? "Creating…" : "Create node key"}
            onClick={() => {
              void handleCreate();
            }}
          />
        </div>
      </PanelSection>

      {syncError ? (
        <PanelSection className="fg-api-key-sync-note">
          <span>Showing stored metadata.</span>
          <button
            className="fg-console-inline-action"
            disabled={busyAction !== null}
            onClick={() => {
              void handleRefresh();
            }}
            type="button"
          >
            {busyAction === "refresh" ? "Retrying…" : "Retry live sync"}
          </button>
        </PanelSection>
      ) : null}

      <PanelSection>
        {keys.length ? (
          <div className="fg-api-key-list">
            {keys.map((record) => {
              const expanded = expandedId === record.id;

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
                        <strong>{record.label}</strong>
                      </div>

                      <p className="fg-api-key-item__meta">
                        {record.status === "revoked" ? "revoked · " : ""}
                        last used {formatRelativeTime(record.lastUsedAt)}
                      </p>
                    </div>

                    <div className="fg-api-key-item__actions">
                      {record.canCopy ? (
                        <InlineActionButton
                          blocked={Boolean(
                            busyAction && busyAction !== `copy:${record.id}`,
                          )}
                          busy={busyAction === `copy:${record.id}`}
                          label="Copy"
                          onClick={() => {
                            void handleCopy(record.id);
                          }}
                        />
                      ) : null}

                      {record.canRevoke ? (
                        <InlineActionButton
                          blocked={Boolean(
                            busyAction && busyAction !== `revoke:${record.id}`,
                          )}
                          busy={busyAction === `revoke:${record.id}`}
                          className="is-danger"
                          label="Revoke"
                          onClick={() => {
                            void handleRevoke(record);
                          }}
                        />
                      ) : null}
                    </div>
                  </div>

                  {expanded ? (
                    <div className="fg-api-key-item__panel">
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
                        <div>
                          <dt>Last used</dt>
                          <dd>{formatRelativeTime(record.lastUsedAt)}</dd>
                        </div>
                      </dl>

                      <p className="fg-api-key-permissions__empty">
                        {record.status === "revoked"
                          ? "This key stays visible for audit history, but it cannot attach new nodes."
                          : "Use this secret with the Fugue join flow when you attach a runtime."}
                      </p>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="fg-api-key-empty">
            <strong>No node keys yet</strong>
            <p>Create one when you attach your first runtime.</p>
          </div>
        )}
      </PanelSection>
    </Panel>
  );
}
