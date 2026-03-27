"use client";

import { useEffect, useRef, useState } from "react";

import { InlineButton } from "@/components/ui/button";
import { Panel, PanelSection } from "@/components/ui/panel";
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

export function NodeKeyManager({
  apiBaseUrl,
  initialKeys,
  initialSyncError,
}: {
  apiBaseUrl: string;
  initialKeys: NodeKeyRecord[];
  initialSyncError: string | null;
}) {
  const { showToast } = useToast();
  const createRequestRef = useRef<() => void>(() => {});
  const copyInFlightRef = useRef<string | null>(null);
  const normalizedApiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
  const [keys, setKeys] = useState(() => sortNodeKeys(initialKeys));
  const [syncError, setSyncError] = useState<string | null>(initialSyncError);
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
                <col className="fg-console-table__col fg-console-table__col--node-key-last-used" />
                <col className="fg-console-table__col fg-console-table__col--node-key-created" />
                <col className="fg-console-table__col fg-console-table__col--node-key-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Node key</th>
                  <th>Prefix</th>
                  <th>Status</th>
                  <th>Last used</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((record) => {
                  const canCopyCommand = canUseNodeKeyForClusterJoin(record);
                  const status = describeStatus(record);

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
                        <span title={record.lastUsedAt ?? "Never"}>{formatRelativeTime(record.lastUsedAt)}</span>
                      </td>
                      <td>
                        <span title={record.createdAt}>{formatRelativeTime(record.createdAt)}</span>
                      </td>
                      <td>
                        <div className="fg-console-toolbar">
                          <InlineButton
                            blocked={Boolean(busyAction)}
                            disabled={!canCopyCommand}
                            label="Copy command"
                            onClick={() => {
                              void handleCopyCommand(record);
                            }}
                          />

                          <InlineButton
                            blocked={Boolean(busyAction)}
                            disabled={!record.canCopy}
                            label="Copy secret"
                            onClick={() => {
                              void handleCopy(record.id);
                            }}
                          />

                          {record.canRevoke ? (
                            <InlineButton
                              blocked={Boolean(
                                busyAction && busyAction !== `revoke:${record.id}`,
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
  );
}
