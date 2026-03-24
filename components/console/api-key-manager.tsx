"use client";

import { startTransition, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { StatusBadge } from "@/components/console/status-badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import type { ApiKeyRecord } from "@/lib/api-keys/types";
import { getFugueScopeDescription } from "@/lib/fugue/scopes";

type FlashState = {
  message: string;
  variant: "error" | "info" | "success";
};

type ApiKeyPagePayload = {
  availableScopes: string[];
  keys: ApiKeyRecord[];
  syncError: string | null;
  workspace: {
    adminKeyId: string;
    tenantId: string;
    tenantName: string;
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

function formatRelativeTime(value?: string | null) {
  if (!value) {
    return "Not yet";
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return "Not yet";
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

function formatStatusTone(status: ApiKeyRecord["status"]) {
  switch (status) {
    case "active":
      return "positive" as const;
    case "disabled":
      return "warning" as const;
    case "deleted":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function formatSourceLabel(source: ApiKeyRecord["source"]) {
  switch (source) {
    case "workspace-admin":
      return "workspace admin";
    case "managed":
      return "created here";
    default:
      return "external";
  }
}

function sortSelectedScopes(scopes: string[], availableScopes: string[]) {
  const scopeOrder = new Map(
    availableScopes.map((scope, index) => [scope, index] as const),
  );

  return [...new Set(scopes)].sort((left, right) => {
    const leftOrder = scopeOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = scopeOrder.get(right) ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.localeCompare(right);
  });
}

function buildDefaultScopes(availableScopes: string[]) {
  const preferred = ["app.write", "app.deploy"].filter((scope) =>
    availableScopes.includes(scope),
  );

  if (preferred.length) {
    return preferred;
  }

  return availableScopes.slice(0, 1);
}

export function ApiKeyManager({
  availableScopes,
  initialKeys,
  initialSyncError,
  workspaceAdminId,
}: {
  availableScopes: string[];
  initialKeys: ApiKeyRecord[];
  initialSyncError: string | null;
  workspaceAdminId: string;
}) {
  const router = useRouter();
  const [keys, setKeys] = useState(initialKeys);
  const [label, setLabel] = useState("");
  const [selectedScopes, setSelectedScopes] = useState(
    buildDefaultScopes(availableScopes),
  );
  const [flash, setFlash] = useState<FlashState | null>(
    initialSyncError
      ? {
          message: `Live Fugue sync failed. Showing stored key metadata instead. ${initialSyncError}`,
          variant: "info",
        }
      : null,
  );
  const [syncError, setSyncError] = useState<string | null>(initialSyncError);
  const [isCreating, setIsCreating] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  async function refreshKeys() {
    const data = await requestJson<ApiKeyPagePayload>("/api/fugue/api-keys", {
      cache: "no-store",
    });

    setKeys(data.keys);
    setSyncError(data.syncError);

    if (data.syncError) {
      setFlash({
        message: `Live Fugue sync failed. Showing stored key metadata instead. ${data.syncError}`,
        variant: "info",
      });
    }

    return data;
  }

  async function handleRefresh() {
    setFlash(null);

    try {
      const data = await refreshKeys();

      if (!data.syncError) {
        setFlash({
          message: "API key list refreshed from Fugue.",
          variant: "success",
        });
      }
    } catch (error) {
      setFlash({
        message: readErrorMessage(error),
        variant: "error",
      });
    }
  }

  function refreshShell() {
    startTransition(() => {
      router.refresh();
    });
  }

  function toggleScope(scope: string) {
    setSelectedScopes((current) => {
      if (current.includes(scope)) {
        return current.filter((item) => item !== scope);
      }

      return sortSelectedScopes([...current, scope], availableScopes);
    });
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isCreating) {
      return;
    }

    setFlash(null);
    setIsCreating(true);

    try {
      await requestJson<{
        key: ApiKeyRecord;
        secret: string;
      }>("/api/fugue/api-keys", {
        body: JSON.stringify({
          label,
          scopes: selectedScopes,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      await refreshKeys();
      setLabel("");
      setSelectedScopes(buildDefaultScopes(availableScopes));
      setFlash({
        message:
          "API key created. The secret is sealed server-side and can be copied from this page.",
        variant: "success",
      });
      refreshShell();
    } catch (error) {
      setFlash({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCopy(keyId: string) {
    if (activeActionId) {
      return;
    }

    setActiveActionId(`copy:${keyId}`);
    setFlash(null);

    try {
      const data = await requestJson<{
        secret: string;
      }>(`/api/fugue/api-keys/${encodeURIComponent(keyId)}/secret`, {
        cache: "no-store",
      });

      await navigator.clipboard.writeText(data.secret);
      setFlash({
        message: "Secret copied to clipboard.",
        variant: "success",
      });
    } catch (error) {
      setFlash({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setActiveActionId(null);
    }
  }

  async function handleStatusChange(record: ApiKeyRecord, action: "disable" | "enable") {
    if (activeActionId) {
      return;
    }

    setActiveActionId(`${action}:${record.id}`);
    setFlash(null);

    try {
      await requestJson<{
        key: ApiKeyRecord;
        localOnly: boolean;
      }>(`/api/fugue/api-keys/${encodeURIComponent(record.id)}`, {
        body: JSON.stringify({
          action,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      await refreshKeys();
      setFlash({
        message:
          action === "disable"
            ? "Key disabled inside fugue-web. Fugue itself does not revoke it yet."
            : "Key re-enabled inside fugue-web.",
        variant: "success",
      });
      refreshShell();
    } catch (error) {
      setFlash({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setActiveActionId(null);
    }
  }

  async function handleDelete(record: ApiKeyRecord) {
    if (activeActionId) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this key from fugue-web? This hides it here, but Fugue itself does not revoke the upstream secret yet.",
    );

    if (!confirmed) {
      return;
    }

    setActiveActionId(`delete:${record.id}`);
    setFlash(null);

    try {
      await requestJson<{
        key: ApiKeyRecord;
        localOnly: boolean;
      }>(`/api/fugue/api-keys/${encodeURIComponent(record.id)}`, {
        method: "DELETE",
      });

      await refreshKeys();
      setFlash({
        message:
          "Key deleted from fugue-web. The upstream Fugue key remains valid until Fugue exposes revoke/delete.",
        variant: "info",
      });
      refreshShell();
    } catch (error) {
      setFlash({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setActiveActionId(null);
    }
  }

  const lockedKey = keys.find((key) => key.id === workspaceAdminId);
  const managedCount = keys.filter((key) => key.source === "managed").length;
  const disabledCount = keys.filter((key) => key.status === "disabled").length;

  return (
    <>
      <section className="fg-console-two-up">
        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">Create key</p>
            <PanelTitle>Tenant-scoped API keys</PanelTitle>
            <PanelCopy>
              Mint additional keys from your stored workspace admin credential. Scope selection is
              capped to what your admin key can already grant.
            </PanelCopy>
          </PanelSection>

          <PanelSection>
            {flash ? (
              <>
                <InlineAlert variant={flash.variant}>{flash.message}</InlineAlert>
                <div style={{ height: "0.85rem" }} aria-hidden="true" />
              </>
            ) : null}

            <form className="fg-form-grid" onSubmit={handleCreate}>
              <FormField
                hint="Use short, operational names like ci-deploy or preview-ops."
                htmlFor="api-key-label"
                label="Label"
              >
                <input
                  className="fg-input"
                  id="api-key-label"
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="ci-deploy"
                  required
                  value={label}
                />
              </FormField>

              <div className="fg-api-key-scope-section">
                <div className="fg-api-key-scope-section__head">
                  <div>
                    <strong>Scopes</strong>
                    <p>Pick the minimum set. Reads remain available through Fugue to any visible key.</p>
                  </div>
                  <StatusBadge tone="neutral">
                    {selectedScopes.length} selected
                  </StatusBadge>
                </div>

                <div className="fg-api-key-scope-grid">
                  {availableScopes.map((scope) => {
                    const selected = selectedScopes.includes(scope);

                    return (
                      <label
                        className={`fg-api-key-scope-card${selected ? " is-selected" : ""}`}
                        key={scope}
                      >
                        <input
                          checked={selected}
                          className="fg-api-key-scope-card__input"
                          onChange={() => toggleScope(scope)}
                          type="checkbox"
                        />
                        <span className="fg-api-key-scope-card__row">
                          <strong>{scope}</strong>
                          <span>{selected ? "selected" : "available"}</span>
                        </span>
                        <span className="fg-api-key-scope-card__copy">
                          {getFugueScopeDescription(scope)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="fg-console-toolbar">
                <Button disabled={isCreating} type="submit" variant="primary">
                  {isCreating ? "Creating…" : "Create key"}
                </Button>
                <button
                  className="fg-console-inline-action"
                  disabled={isCreating}
                  onClick={() => {
                    void handleRefresh();
                  }}
                  type="button"
                >
                  Refresh list
                </button>
              </div>
            </form>
          </PanelSection>
        </Panel>

        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">Current policy</p>
            <PanelTitle>What this page can and cannot do</PanelTitle>
            <PanelCopy>
              Fugue currently exposes list and create for tenant API keys. Disable and delete on
              this page are enforced inside fugue-web only until Fugue ships upstream revoke.
            </PanelCopy>
          </PanelSection>

          <PanelSection>
            <ul className="fg-console-stat-list">
              <li>
                <strong>Workspace admin</strong>
                <span>{lockedKey ? lockedKey.label : "Stored"}</span>
              </li>
              <li>
                <strong>Created here</strong>
                <span>{managedCount}</span>
              </li>
              <li>
                <strong>Disabled locally</strong>
                <span>{disabledCount}</span>
              </li>
              <li>
                <strong>Live sync</strong>
                <span>{syncError ? "stored fallback" : "live"}</span>
              </li>
            </ul>

            <div className="fg-console-note-block">
              <strong>Copy behavior</strong>
              <p>Copy works only when fugue-web knows the secret. External keys discovered from Fugue remain visible, but their secret stays unavailable.</p>
            </div>

            <div className="fg-console-note-block">
              <strong>Locked key</strong>
              <p>The workspace admin key keeps this console running. It can be copied, but not disabled or deleted from this surface.</p>
            </div>
          </PanelSection>
        </Panel>
      </section>

      <Panel>
        <PanelSection>
          <p className="fg-label fg-panel__eyebrow">Inventory</p>
          <PanelTitle>Visible API keys</PanelTitle>
          <PanelCopy>
            Workspace admin is pinned first. Other keys can be copied, disabled, or deleted from
            the product layer.
          </PanelCopy>
        </PanelSection>

        <PanelSection>
          <div className="fg-api-key-list">
            {keys.map((record) => {
              const isCopying = activeActionId === `copy:${record.id}`;
              const isDisabling = activeActionId === `disable:${record.id}`;
              const isEnabling = activeActionId === `enable:${record.id}`;
              const isDeleting = activeActionId === `delete:${record.id}`;

              return (
                <article className="fg-api-key-card" key={record.id}>
                  <div className="fg-api-key-card__head">
                    <div className="fg-api-key-card__copy">
                      <div className="fg-console-list__title-row">
                        <strong>{record.label}</strong>
                        <div className="fg-console-inline-status">
                          <StatusBadge tone={formatStatusTone(record.status)}>
                            {record.status}
                          </StatusBadge>
                          <StatusBadge tone={record.isWorkspaceAdmin ? "info" : "neutral"}>
                            {record.isWorkspaceAdmin ? "locked" : formatSourceLabel(record.source)}
                          </StatusBadge>
                        </div>
                      </div>
                      <p>
                        {record.prefix
                          ? `${record.prefix} / ${record.id}`
                          : `${record.id} / secret unavailable`}
                      </p>
                    </div>

                    <div className="fg-api-key-card__actions">
                      <button
                        className="fg-console-inline-action"
                        disabled={!record.canCopy || Boolean(activeActionId)}
                        onClick={() => {
                          void handleCopy(record.id);
                        }}
                        type="button"
                      >
                        {isCopying ? "Copying…" : "Copy"}
                      </button>

                      {record.status === "disabled" ? (
                        <button
                          className="fg-console-inline-action"
                          disabled={!record.canDisable || Boolean(activeActionId)}
                          onClick={() => {
                            void handleStatusChange(record, "enable");
                          }}
                          type="button"
                        >
                          {isEnabling ? "Enabling…" : "Enable"}
                        </button>
                      ) : (
                        <button
                          className="fg-console-inline-action"
                          disabled={!record.canDisable || Boolean(activeActionId)}
                          onClick={() => {
                            void handleStatusChange(record, "disable");
                          }}
                          type="button"
                        >
                          {isDisabling ? "Disabling…" : "Disable"}
                        </button>
                      )}

                      <button
                        className="fg-console-inline-action is-danger"
                        disabled={!record.canDelete || Boolean(activeActionId)}
                        onClick={() => {
                          void handleDelete(record);
                        }}
                        type="button"
                      >
                        {isDeleting ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>

                  <dl className="fg-api-key-card__facts">
                    <div>
                      <dt>Last used</dt>
                      <dd>{formatRelativeTime(record.lastUsedAt)}</dd>
                    </div>
                    <div>
                      <dt>Updated</dt>
                      <dd>{formatRelativeTime(record.updatedAt)}</dd>
                    </div>
                    <div>
                      <dt>Secret</dt>
                      <dd>{record.secretStored ? "stored" : "not stored"}</dd>
                    </div>
                  </dl>

                  <div className="fg-api-key-card__scopes">
                    {record.scopes.map((scope) => (
                      <span className="fg-api-key-scope-pill" key={`${record.id}:${scope}`}>
                        {scope}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </PanelSection>
      </Panel>
    </>
  );
}
