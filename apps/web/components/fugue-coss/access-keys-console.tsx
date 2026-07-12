"use client";

import { Alert, AlertDescription, AlertTitle } from "@fugue/ui/components/alert";
import { Badge } from "@fugue/ui/components/badge";
import { Button } from "@fugue/ui/components/button";
import { CardContent, CardFrame } from "@fugue/ui/components/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@fugue/ui/components/empty";
import { Field, FieldDescription, FieldLabel } from "@fugue/ui/components/field";
import { Input } from "@fugue/ui/components/input";
import { Skeleton } from "@fugue/ui/components/skeleton";
import { toastManager } from "@fugue/ui/components/toast";
import { useCopyToClipboard } from "@fugue/ui/hooks/use-copy-to-clipboard";
import { Copy } from "lucide-react";
import { useState } from "react";
import {
  ConsoleLoadError,
  ConsoleLoadingState,
} from "@/components/console/async-state";
import { ConsoleCardHeader } from "@/components/console/card-header";
import { DataTable } from "@/components/console/data-table";
import { ConfirmationDialog, ConsoleDrawer } from "@/components/console/overlays";
import { useClientUiMessages } from "@/components/i18n/locale-select";
import { CodeBlock } from "@/components/shared/code-block";
import {
  CONSOLE_API_KEYS_PAGE_SNAPSHOT_URL,
  type ConsoleApiKeysPageSnapshot,
  invalidateConsolePageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";
import type { AccessKeysStateMessages } from "@/lib/i18n/console-messages";
import type { Locale } from "@/lib/i18n/core";
import { readRequestError, requestJson } from "@/lib/ui/request-json";

function useToast() {
  return {
    notify(value: string) {
      toastManager.add({ title: value });
    },
  };
}

type CossBadgeTone = "default" | "success" | "warning" | "destructive" | "info";
type ReadyAccessKeysSnapshot = Extract<ConsoleApiKeysPageSnapshot, { state: "ready" }>;
type WorkspaceApiKey = ReadyAccessKeysSnapshot["apiKeys"]["keys"][number];
type NodeEnrollmentKey = ReadyAccessKeysSnapshot["nodeKeys"]["keys"][number];
type SecretPanelState = {
  description: string;
  title: string;
  value: string;
};
type AccessKeyConfirmState = {
  action: () => Promise<void>;
  confirmLabel: string;
  description: string;
  title: string;
};

function formatKeyTimestamp(
  locale: Locale,
  value: string | null | undefined,
  fallback: string,
) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatKeyScopes(scopes: string[], noScopes: string) {
  return scopes.length ? scopes.join(", ") : noScopes;
}

function formatAttachedVpsCount(value: number | null, syncing: string) {
  if (value === null) {
    return syncing;
  }

  return `${value} VPS`;
}

function keyStatusTone(status: string): CossBadgeTone {
  if (status === "active") return "success";
  if (status === "disabled") return "warning";
  return "destructive";
}

function buildNodeJoinCommand(apiBaseUrl: string, secret: string) {
  const baseUrl = apiBaseUrl.replace(/\/$/, "");

  return [
    `curl -fsSL ${baseUrl}/install/join-cluster.sh | \\`,
    `  sudo FUGUE_NODE_KEY='${secret}' \\`,
    "  bash",
  ].join("\n");
}

export function AccessKeysConsole({
  locale,
  stateMessages,
}: {
  locale: Locale;
  stateMessages: AccessKeysStateMessages;
}) {
  const messages = useClientUiMessages();
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleApiKeysPageSnapshot>(
      CONSOLE_API_KEYS_PAGE_SNAPSHOT_URL,
      {
        ttlMs: 15_000,
      },
    );
  const [createNodeOpen, setCreateNodeOpen] = useState(false);
  const [nodeLabel, setNodeLabel] = useState("");
  const [renameNode, setRenameNode] = useState<NodeEnrollmentKey | null>(null);
  const [renameLabel, setRenameLabel] = useState("");
  const [secretPanel, setSecretPanel] = useState<SecretPanelState | null>(null);
  const [confirm, setConfirm] = useState<AccessKeyConfirmState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const toast = useToast();
  const { copyToClipboard } = useCopyToClipboard();
  const ready = data?.state === "ready" ? data : null;
  const initialLoading = loading && !data;

  async function refreshAccessKeys() {
    invalidateConsolePageSnapshot(CONSOLE_API_KEYS_PAGE_SNAPSHOT_URL);
    await refresh({ force: true });
  }

  async function runKeyAction<T>(key: string, action: () => Promise<T>) {
    setBusy(key);
    setActionError(null);

    try {
      return await action();
    } catch (nextError) {
      setActionError(readRequestError(nextError));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function revealApiKeySecret(row: WorkspaceApiKey) {
    const result = await runKeyAction(`api-secret:${row.id}`, () =>
      requestJson<{ secret: string }>(
        `/api/fugue/api-keys/${encodeURIComponent(row.id)}/secret`,
        {
          cache: "no-store",
        },
      ),
    );

    if (!result) {
      return;
    }

    setSecretPanel({
      description: "Copy this API key into your local Fugue CLI or CI secret store.",
      title: `${row.label} secret`,
      value: result.secret,
    });
  }

  async function rotateApiKey(row: WorkspaceApiKey) {
    const result = await runKeyAction(`api-rotate:${row.id}`, () =>
      requestJson<{ key: WorkspaceApiKey; secret?: string }>(
        `/api/fugue/api-keys/${encodeURIComponent(row.id)}/rotate`,
        {
          cache: "no-store",
          method: "POST",
        },
      ),
    );

    if (!result) {
      return;
    }

    if (result.secret) {
      setSecretPanel({
        description: "Copy this rotated API key before closing the panel.",
        title: `${result.key.label} rotated secret`,
        value: result.secret,
      });
    }

    await refreshAccessKeys();
    toast.notify("API key rotated.");
  }

  async function toggleApiKey(row: WorkspaceApiKey) {
    const endpoint = row.status === "disabled" ? "enable" : "disable";
    const result = await runKeyAction(`api-toggle:${row.id}`, () =>
      requestJson<{ key: WorkspaceApiKey }>(
        `/api/fugue/api-keys/${encodeURIComponent(row.id)}/${endpoint}`,
        {
          cache: "no-store",
          method: "POST",
        },
      ),
    );

    if (!result) {
      return;
    }

    await refreshAccessKeys();
    toast.notify(row.status === "disabled" ? "API key enabled." : "API key disabled.");
  }

  async function deleteApiKey(row: WorkspaceApiKey) {
    const result = await runKeyAction(`api-delete:${row.id}`, () =>
      requestJson<{ key: WorkspaceApiKey }>(
        `/api/fugue/api-keys/${encodeURIComponent(row.id)}`,
        {
          cache: "no-store",
          method: "DELETE",
        },
      ),
    );

    if (!result) {
      return;
    }

    await refreshAccessKeys();
    toast.notify("API key deleted.");
  }

  async function provisionWorkspaceKey() {
    const result = await runKeyAction("api-create", () =>
      requestJson<{ key: WorkspaceApiKey; secret: string }>("/api/fugue/api-keys", {
        cache: "no-store",
        method: "POST",
      }),
    );

    if (!result) {
      return;
    }

    setSecretPanel({
      description: "Copy this workspace API key before closing the panel.",
      title: `${result.key.label} secret`,
      value: result.secret,
    });
    await refreshAccessKeys();
  }

  async function revealNodeJoinCommand(row: NodeEnrollmentKey) {
    const result = await runKeyAction(`node-secret:${row.id}`, () =>
      requestJson<{ secret: string }>(
        `/api/fugue/node-keys/${encodeURIComponent(row.id)}/secret`,
        {
          cache: "no-store",
        },
      ),
    );

    if (!result || !ready) {
      return;
    }

    setSecretPanel({
      description: "Run this command on the VPS you want to attach to this workspace.",
      title: `${row.label} join command`,
      value: buildNodeJoinCommand(ready.apiBaseUrl, result.secret),
    });
  }

  async function createNodeKey() {
    const label = nodeLabel.trim();
    const result = await runKeyAction("node-create", () =>
      requestJson<{ key: NodeEnrollmentKey; secret: string }>("/api/fugue/node-keys", {
        body: JSON.stringify(label ? { label } : {}),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );

    if (!result || !ready) {
      return;
    }

    setCreateNodeOpen(false);
    setNodeLabel("");
    setSecretPanel({
      description: "Run this command on the VPS you want to attach to this workspace.",
      title: `${result.key.label} join command`,
      value: buildNodeJoinCommand(ready.apiBaseUrl, result.secret),
    });
    await refreshAccessKeys();
  }

  async function saveNodeRename() {
    if (!renameNode) {
      return;
    }

    const result = await runKeyAction(`node-rename:${renameNode.id}`, () =>
      requestJson<{ key: NodeEnrollmentKey }>(
        `/api/fugue/node-keys/${encodeURIComponent(renameNode.id)}`,
        {
          body: JSON.stringify({ label: renameLabel }),
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      ),
    );

    if (!result) {
      return;
    }

    setRenameNode(null);
    setRenameLabel("");
    await refreshAccessKeys();
    toast.notify("Node key renamed.");
  }

  async function revokeNodeKey(row: NodeEnrollmentKey) {
    const result = await runKeyAction(`node-revoke:${row.id}`, () =>
      requestJson<{ key: NodeEnrollmentKey }>(
        `/api/fugue/node-keys/${encodeURIComponent(row.id)}/revoke`,
        {
          cache: "no-store",
          method: "POST",
        },
      ),
    );

    if (!result) {
      return;
    }

    await refreshAccessKeys();
    toast.notify("Node key revoked.");
  }

  async function runConfirm() {
    const nextConfirm = confirm;

    if (!nextConfirm) {
      return;
    }

    await nextConfirm.action();
    setConfirm(null);
  }

  return (
    <>
      <div className="coss-stack">
        {error ? (
          <ConsoleLoadError
            description={error}
            onRetry={refreshAccessKeys}
            retryLabel={stateMessages.retry}
            title={stateMessages.keysUnavailable}
          />
        ) : null}
        {actionError ? (
          <Alert variant="error" role="alert">
            <AlertTitle>{stateMessages.operationFailed}</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}
        {initialLoading ? (
          <ConsoleLoadingState className="coss-stack" label="Loading access keys">
            <CardFrame>
              <ConsoleCardHeader
                title="Workspace API keys"
                description="Loading workspace access keys."
              />
              <CardContent className="coss-stack-sm">
                <Skeleton
                  style={{
                    height: 42,
                  }}
                />
                <Skeleton
                  style={{
                    height: 42,
                  }}
                />
                <Skeleton
                  style={{
                    height: 42,
                  }}
                />
              </CardContent>
            </CardFrame>
            <CardFrame>
              <ConsoleCardHeader
                title="Node enrollment keys"
                description="Loading reusable VPS enrollment keys."
              />
              <CardContent className="coss-stack-sm">
                <Skeleton
                  style={{
                    height: 42,
                  }}
                />
                <Skeleton
                  style={{
                    height: 42,
                  }}
                />
                <Skeleton
                  style={{
                    height: 42,
                  }}
                />
              </CardContent>
            </CardFrame>
          </ConsoleLoadingState>
        ) : data?.state === "workspace-missing" ? (
          <CardFrame>
            <CardContent>
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>{stateMessages.workspaceNotReady}</EmptyTitle>
                  <EmptyDescription>
                    {stateMessages.workspaceNotReadyDescription}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </CardFrame>
        ) : ready ? (
          <>
            {ready.apiKeys.syncError ? (
              <Alert variant="warning" role="status">
                <AlertTitle>{stateMessages.apiKeySyncWarning}</AlertTitle>
                <AlertDescription>{ready.apiKeys.syncError}</AlertDescription>
              </Alert>
            ) : null}
            {ready.nodeKeys.syncError ? (
              <Alert variant="warning" role="status">
                <AlertTitle>{stateMessages.nodeKeySyncWarning}</AlertTitle>
                <AlertDescription>{ready.nodeKeys.syncError}</AlertDescription>
              </Alert>
            ) : null}
            <WorkspaceApiKeyTable
              messages={stateMessages}
              locale={locale}
              keys={ready.apiKeys.keys}
              busy={busy}
              onDelete={(row) =>
                setConfirm({
                  action: () => deleteApiKey(row),
                  confirmLabel: "Delete key",
                  description: `${row.label} will stop working for API and CLI calls.`,
                  title: "Delete API key?",
                })
              }
              onProvision={provisionWorkspaceKey}
              onReveal={revealApiKeySecret}
              onRotate={rotateApiKey}
              onToggle={toggleApiKey}
            />
            <NodeEnrollmentKeyTable
              messages={stateMessages}
              locale={locale}
              keys={ready.nodeKeys.keys}
              busy={busy}
              onCreate={() => setCreateNodeOpen(true)}
              onReveal={revealNodeJoinCommand}
              onRename={(row) => {
                setRenameNode(row);
                setRenameLabel(row.label);
              }}
              onRevoke={(row) =>
                setConfirm({
                  action: () => revokeNodeKey(row),
                  confirmLabel: "Revoke key",
                  description: `${row.label} will no longer enroll new VPS nodes. Existing attached nodes are not renamed here.`,
                  title: "Revoke node key?",
                })
              }
            />
          </>
        ) : null}
      </div>
      <ConsoleDrawer
        title="Create node enrollment key"
        description="Create a reusable key for attaching a VPS to this workspace."
        open={createNodeOpen}
        onClose={() => setCreateNodeOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateNodeOpen(false)}>
              Cancel
            </Button>
            <Button loading={busy === "node-create"} onClick={createNodeKey}>
              Create node key
            </Button>
          </>
        }
      >
        <div className="coss-form">
          <Field>
            <FieldLabel htmlFor="node-key-create-name">Name</FieldLabel>
            <Input
              autoComplete="off"
              id="node-key-create-name"
              name="nodeKeyName"
              value={nodeLabel}
              onChange={(event) => setNodeLabel(event.target.value)}
              placeholder="node…"
            />
            <FieldDescription>
              Leave blank to let Fugue generate the node key label.
            </FieldDescription>
          </Field>
        </div>
      </ConsoleDrawer>
      <ConsoleDrawer
        title="Rename node key"
        description={
          renameNode ? `Update the display name for ${renameNode.id}.` : undefined
        }
        open={Boolean(renameNode)}
        onClose={() => setRenameNode(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setRenameNode(null)}>
              Cancel
            </Button>
            <Button
              loading={renameNode ? busy === `node-rename:${renameNode.id}` : false}
              disabled={!renameLabel.trim()}
              onClick={saveNodeRename}
            >
              Save name
            </Button>
          </>
        }
      >
        <div className="coss-form">
          <Field>
            <FieldLabel htmlFor="node-key-rename-name">Name</FieldLabel>
            <Input
              autoComplete="off"
              id="node-key-rename-name"
              name="nodeKeyRename"
              value={renameLabel}
              onChange={(event) => setRenameLabel(event.target.value)}
            />
          </Field>
        </div>
      </ConsoleDrawer>
      <ConsoleDrawer
        title={secretPanel?.title ?? ""}
        description={secretPanel?.description}
        open={Boolean(secretPanel)}
        onClose={() => setSecretPanel(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setSecretPanel(null)}>
              {messages.close}
            </Button>
            <Button
              onClick={() => {
                if (secretPanel) {
                  void copyToClipboard(secretPanel.value).then((copied) => {
                    toast.notify(copied ? messages.copySucceeded : messages.copyFailed);
                  });
                }
              }}
            >
              <Copy aria-hidden="true" />
              {messages.copy}
            </Button>
          </>
        }
      >
        {secretPanel ? <CodeBlock>{secretPanel.value}</CodeBlock> : null}
      </ConsoleDrawer>
      <ConfirmationDialog
        title={confirm?.title ?? ""}
        description={confirm?.description ?? ""}
        open={Boolean(confirm)}
        confirmLabel={confirm?.confirmLabel ?? "Confirm"}
        confirmLoading={Boolean(confirm && busy !== null)}
        onConfirm={() => void runConfirm()}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}

function WorkspaceApiKeyTable({
  messages,
  locale,
  keys,
  busy,
  onDelete,
  onProvision,
  onReveal,
  onRotate,
  onToggle,
}: {
  messages: AccessKeysStateMessages;
  locale: Locale;
  keys: WorkspaceApiKey[];
  busy: string | null;
  onDelete: (row: WorkspaceApiKey) => void;
  onProvision: () => void;
  onReveal: (row: WorkspaceApiKey) => void;
  onRotate: (row: WorkspaceApiKey) => void;
  onToggle: (row: WorkspaceApiKey) => void;
}) {
  return (
    <CardFrame>
      <ConsoleCardHeader
        title="Workspace API keys"
        description="Real Fugue API keys for this workspace. Workspace admin keys are protected from disable/delete."
        action={
          !keys.length ? (
            <Button loading={busy === "api-create"} onClick={onProvision}>
              Provision workspace key
            </Button>
          ) : null
        }
      />
      <CardContent>
        {!keys.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{messages.noApiKeys}</EmptyTitle>
              <EmptyDescription>{messages.noApiKeysDescription}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
        <DataTable
          columns={["Name", "Scopes", "Status", "Last used", "Actions"]}
          rows={keys}
          renderRow={(row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.label}</strong>
                <div className="coss-help coss-mono">
                  {row.prefix ? `${row.prefix}...` : row.id}
                </div>
              </td>
              <td className="coss-mono">
                {formatKeyScopes(row.scopes, messages.noScopes)}
              </td>
              <td>
                <span className="coss-row">
                  <Badge variant={keyStatusTone(row.status)}>{row.status}</Badge>
                  {row.isWorkspaceAdmin ? (
                    <Badge variant="info">workspace admin</Badge>
                  ) : null}
                </span>
              </td>
              <td>{formatKeyTimestamp(locale, row.lastUsedAt, messages.never)}</td>
              <td className="coss-table__actions">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!row.canCopy}
                  loading={busy === `api-secret:${row.id}`}
                  aria-label={`Copy secret for ${row.label}`}
                  onClick={() => onReveal(row)}
                >
                  Copy secret
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  loading={busy === `api-rotate:${row.id}`}
                  aria-label={`Rotate ${row.label}`}
                  onClick={() => onRotate(row)}
                >
                  Rotate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!row.canDisable}
                  loading={busy === `api-toggle:${row.id}`}
                  aria-label={`${row.status === "disabled" ? "Enable" : "Disable"} ${row.label}`}
                  onClick={() => onToggle(row)}
                >
                  {row.status === "disabled" ? "Enable" : "Disable"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!row.canDelete}
                  loading={busy === `api-delete:${row.id}`}
                  aria-label={`Delete ${row.label}`}
                  onClick={() => onDelete(row)}
                >
                  Delete
                </Button>
              </td>
            </tr>
          )}
        />
      </CardContent>
    </CardFrame>
  );
}

function NodeEnrollmentKeyTable({
  messages,
  locale,
  keys,
  busy,
  onCreate,
  onReveal,
  onRename,
  onRevoke,
}: {
  messages: AccessKeysStateMessages;
  locale: Locale;
  keys: NodeEnrollmentKey[];
  busy: string | null;
  onCreate: () => void;
  onReveal: (row: NodeEnrollmentKey) => void;
  onRename: (row: NodeEnrollmentKey) => void;
  onRevoke: (row: NodeEnrollmentKey) => void;
}) {
  return (
    <CardFrame>
      <ConsoleCardHeader
        title="Node enrollment keys"
        description="Reusable tenant runtime keys used by VPS nodes attached to this workspace."
        action={<Button onClick={onCreate}>Create node key</Button>}
      />
      <CardContent>
        {!keys.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{messages.noNodeKeys}</EmptyTitle>
              <EmptyDescription>{messages.noNodeKeysDescription}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {<Button onClick={onCreate}>Create node key</Button>}
            </EmptyContent>
          </Empty>
        ) : null}
        <DataTable
          columns={["Name", "Prefix", "Attached VPS", "Status", "Last used", "Actions"]}
          rows={keys}
          renderRow={(row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.label}</strong>
                <div className="coss-help coss-mono">{row.id}</div>
              </td>
              <td className="coss-mono">
                {row.prefix ? `${row.prefix}...` : messages.unavailable}
              </td>
              <td>{formatAttachedVpsCount(row.attachedVpsCount, messages.syncing)}</td>
              <td>
                <Badge variant={keyStatusTone(row.status)}>{row.status}</Badge>
              </td>
              <td>{formatKeyTimestamp(locale, row.lastUsedAt, messages.never)}</td>
              <td className="coss-table__actions">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!row.canCopy}
                  loading={busy === `node-secret:${row.id}`}
                  aria-label={`Copy join command for ${row.label}`}
                  onClick={() => onReveal(row)}
                >
                  Copy join command
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={row.status !== "active"}
                  loading={busy === `node-rename:${row.id}`}
                  aria-label={`Rename ${row.label}`}
                  onClick={() => onRename(row)}
                >
                  Rename
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!row.canRevoke}
                  loading={busy === `node-revoke:${row.id}`}
                  aria-label={`Revoke ${row.label}`}
                  onClick={() => onRevoke(row)}
                >
                  Revoke
                </Button>
              </td>
            </tr>
          )}
        />
      </CardContent>
    </CardFrame>
  );
}
