"use client";

import { Alert, AlertDescription, AlertTitle } from "@fugue/ui/components/alert";
import { Badge } from "@fugue/ui/components/badge";
import { Button } from "@fugue/ui/components/button";
import { Card, CardContent, CardFrame } from "@fugue/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@fugue/ui/components/empty";
import { Input } from "@fugue/ui/components/input";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@fugue/ui/components/select";
import { Skeleton } from "@fugue/ui/components/skeleton";
import { toastManager } from "@fugue/ui/components/toast";
import { RotateCcw } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { ConsoleLoadingState } from "@/components/console/async-state";
import { ConsoleCardHeader } from "@/components/console/card-header";
import { CursorPagination } from "@/components/console/cursor-pagination";
import { DataTable } from "@/components/console/data-table";
import { MetricStrip } from "@/components/console/metric-strip";
import { ConfirmationDialog, ConsoleDrawer } from "@/components/console/overlays";
import type { ConsoleAdminUsersPageSnapshot } from "@/lib/console/page-snapshot-types";
import type { ConsoleTone } from "@/lib/console/types";
import {
  useBoundedConsolePage,
  useDebouncedValue,
} from "@/lib/console/use-bounded-page";
import type { AdminUsersStateMessages } from "@/lib/i18n/console-messages";
import { readRequestError, requestJson } from "@/lib/ui/request-json";

function useToast() {
  return {
    notify(value: string) {
      toastManager.add({ title: value });
    },
  };
}

type CossBadgeTone = "default" | "success" | "warning" | "destructive" | "info";
function badgeToneFromConsoleTone(tone: ConsoleTone): CossBadgeTone {
  if (tone === "positive") return "success";
  if (tone === "danger") return "destructive";
  if (tone === "warning") return "warning";
  if (tone === "info") return "info";
  return "default";
}

type AdminConfirmOperation = {
  body?: unknown;
  confirmLabel?: string;
  description: string;
  endpoint: string;
  method: "DELETE" | "PATCH" | "POST";
  successMessage: string;
  title: string;
};

type AdminUserView = ConsoleAdminUsersPageSnapshot["users"][number];

function adminValue(value: string | null | undefined, fallback: string) {
  return value?.trim() ? value : fallback;
}

function requestAdminOperation(operation: AdminConfirmOperation) {
  const init: RequestInit = {
    cache: "no-store",
    method: operation.method,
  };

  if (operation.body !== undefined) {
    init.body = JSON.stringify(operation.body);
    init.headers = {
      "Content-Type": "application/json",
    };
  }

  return requestJson<unknown>(operation.endpoint, init);
}

function AdminSnapshotErrors({
  errors,
  messages,
}: {
  errors?: string[];
  messages: AdminUsersStateMessages;
}) {
  if (!errors?.length) {
    return null;
  }

  return (
    <Alert variant="warning" role="status">
      <AlertTitle>{messages.snapshotPartiallyLoaded}</AlertTitle>
      <AlertDescription>{errors.join(" · ")}</AlertDescription>
    </Alert>
  );
}

function DetailMetric({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <Card className="coss-card--muted">
      <CardContent className="coss-stack-sm">
        <span className="coss-help">{label}</span>
        <strong className={mono ? "coss-mono" : undefined}>{value}</strong>
      </CardContent>
    </Card>
  );
}

export function AdminUsersConsole({ messages }: { messages: AdminUsersStateMessages }) {
  const [drawer, setDrawer] = useState<AdminUserView | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [operation, setOperation] = useState<AdminConfirmOperation | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operating, setOperating] = useState(false);
  const toast = useToast();
  const debouncedQuery = useDebouncedValue(query, 300);
  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({ limit: "50" });
    if (debouncedQuery.trim()) {
      params.set("q", debouncedQuery.trim());
    }
    if (status !== "all") {
      params.set("status", status);
    }
    if (cursor) {
      params.set("cursor", cursor);
    }
    return `/api/fugue/admin/pages/users?${params.toString()}`;
  }, [cursor, debouncedQuery, status]);
  const { data, error, loading, refresh } =
    useBoundedConsolePage<ConsoleAdminUsersPageSnapshot>(requestUrl, {
      enabled: query === debouncedQuery,
      onCursorExpired: () => {
        setCursor(null);
        setDrawer(null);
        setOperationError(messages.listChanged);
      },
    });
  const users = data?.users ?? [];
  const rows = useMemo(
    () =>
      users.map((user) => ({
        ...user,
        id: user.email,
      })),
    [users],
  );

  function refreshUsers() {
    setOperationError(null);
    refresh();
  }

  async function confirmOperation() {
    if (!operation) {
      return;
    }

    setOperating(true);
    setOperationError(null);

    try {
      await requestAdminOperation(operation);
      setCursor(null);
      refresh();
      toast.notify(operation.successMessage);
      setOperation(null);
      setDrawer(null);
    } catch (error) {
      setOperationError(readRequestError(error));
    } finally {
      setOperating(false);
    }
  }

  function queueUserOperation(
    user: AdminUserView,
    kind: "block" | "delete" | "demote" | "promote" | "unblock",
  ) {
    const encodedEmail = encodeURIComponent(user.email);
    const baseEndpoint = `/api/admin/users/${encodedEmail}`;
    const titleName = user.name || user.email;

    if (kind === "promote") {
      setOperation({
        confirmLabel: "Promote",
        description: `${user.email} will receive administrator permissions.`,
        endpoint: `${baseEndpoint}/admin`,
        method: "POST",
        successMessage: `${titleName} promoted to admin`,
        title: `Promote ${titleName}`,
      });
      return;
    }

    if (kind === "demote") {
      setOperation({
        confirmLabel: "Demote",
        description: `${user.email} will lose administrator permissions. Last-admin protection is enforced by the server.`,
        endpoint: `${baseEndpoint}/admin`,
        method: "DELETE",
        successMessage: `${titleName} demoted`,
        title: `Demote ${titleName}`,
      });
      return;
    }

    if (kind === "block") {
      setOperation({
        confirmLabel: "Block",
        description: `${user.email} will be blocked from the product.`,
        endpoint: `${baseEndpoint}/block`,
        method: "POST",
        successMessage: `${titleName} blocked`,
        title: `Block ${titleName}`,
      });
      return;
    }

    if (kind === "unblock") {
      setOperation({
        confirmLabel: "Unblock",
        description: `${user.email} will be restored to active status.`,
        endpoint: `${baseEndpoint}/unblock`,
        method: "POST",
        successMessage: `${titleName} unblocked`,
        title: `Unblock ${titleName}`,
      });
      return;
    }

    setOperation({
      confirmLabel: "Delete",
      description: `${user.email} will be marked deleted. This action is destructive.`,
      endpoint: baseEndpoint,
      method: "DELETE",
      successMessage: `${titleName} deleted`,
      title: `Delete ${titleName}`,
    });
  }

  return (
    <>
      <div className="coss-stack">
        <MetricStrip
          items={[
            { label: "Users", value: String(data?.summary.userCount ?? users.length) },
            {
              label: "Admins",
              tone: "warning",
              value: String(
                data?.summary.adminCount ?? users.filter((user) => user.isAdmin).length,
              ),
            },
            {
              label: "Blocked",
              tone: "destructive",
              value: String(
                data?.summary.blockedCount ??
                  users.filter((user) => user.status === "blocked").length,
              ),
            },
            {
              label: "Deleted",
              value: String(
                data?.summary.deletedCount ??
                  users.filter((user) => user.status === "deleted").length,
              ),
            },
          ]}
        />
        <CardFrame>
          <ConsoleCardHeader
            title="Users"
            description="Live user directory, workspace ownership, billing state, admin permissions, blocking, and deletion."
            action={
              <Button
                variant="outline"
                size="sm"
                loading={loading}
                onClick={() => {
                  refreshUsers();
                }}
              >
                {loading ? null : <RotateCcw aria-hidden="true" />}
                Refresh
              </Button>
            }
          />
          <CardContent className="coss-stack">
            <div className="coss-row">
              <Input
                aria-label="Search users"
                autoComplete="off"
                className="coss-input--medium"
                maxLength={200}
                name="userSearch"
                placeholder="Search email, name, or provider…"
                spellCheck={false}
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCursor(null);
                }}
              />
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value ?? "all");
                  setCursor(null);
                }}
              >
                <SelectTrigger aria-label="Filter users" className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                </SelectPopup>
              </Select>
            </div>

            {operationError ? (
              <Alert variant="error" role="alert">
                <AlertTitle>{messages.adminOperationFailed}</AlertTitle>
                <AlertDescription>{operationError}</AlertDescription>
              </Alert>
            ) : null}
            {error ? (
              <Alert variant="error" role="alert">
                <AlertTitle>{messages.usersUnavailable}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <AdminSnapshotErrors errors={data?.errors} messages={messages} />

            {loading && !data ? (
              <ConsoleLoadingState className="coss-stack-sm" label="Loading users">
                <Skeleton
                  style={{
                    height: 44,
                  }}
                />
                <Skeleton
                  style={{
                    height: 48,
                  }}
                />
                <Skeleton
                  style={{
                    height: 48,
                  }}
                />
              </ConsoleLoadingState>
            ) : null}

            {!loading && !error && rows.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>
                    {query.trim() || status !== "all"
                      ? messages.noUsersMatch
                      : messages.noUsers}
                  </EmptyTitle>
                  <EmptyDescription>
                    {query.trim() || status !== "all"
                      ? messages.clearFilterDescription
                      : messages.emptyDirectoryDescription}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}

            {rows.length > 0 ? (
              <DataTable
                columns={["User", "Status", "Admin", "Usage", "Billing", "Actions"]}
                rows={rows}
                renderRow={(row) => (
                  <tr key={row.email}>
                    <td>
                      <div className="coss-stack-sm">
                        <strong>{row.name || row.email}</strong>
                        <span className="coss-help">{row.email}</span>
                        <span className="coss-help">
                          {row.provider} · {row.verified ? "verified" : "unverified"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <Badge variant={badgeToneFromConsoleTone(row.statusTone)}>
                        {row.status}
                      </Badge>
                    </td>
                    <td>
                      <Badge variant={row.isAdmin ? "warning" : "default"}>
                        {row.isAdmin ? "admin" : "member"}
                      </Badge>
                    </td>
                    <td>
                      <div className="coss-stack-sm">
                        <strong>{row.usage.serviceCountLabel}</strong>
                        <span className="coss-help">
                          {row.usage.cpuLabel} · {row.usage.memoryLabel}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="coss-stack-sm">
                        <strong>{row.billing.limitLabel}</strong>
                        <span className="coss-help">
                          {adminValue(
                            row.billing.balanceLabel ?? row.billing.statusLabel,
                            messages.noBalanceData,
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="coss-table__actions">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDrawer(row)}
                      >
                        Details
                      </Button>
                      {row.isAdmin ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!row.canDemoteAdmin || operating}
                          onClick={() => queueUserOperation(row, "demote")}
                        >
                          Demote
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!row.canPromoteToAdmin || operating}
                          onClick={() => queueUserOperation(row, "promote")}
                        >
                          Promote
                        </Button>
                      )}
                      {row.status === "blocked" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!row.canUnblock || operating}
                          onClick={() => queueUserOperation(row, "unblock")}
                        >
                          Unblock
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!row.canBlock || operating}
                          onClick={() => queueUserOperation(row, "block")}
                        >
                          Block
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={!row.canDelete || operating}
                        onClick={() => queueUserOperation(row, "delete")}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                )}
              />
            ) : null}
            {data?.pageInfo ? (
              <CursorPagination
                disabled={loading || operating}
                pageInfo={data.pageInfo}
                visibleCount={rows.length}
                onNext={setCursor}
                onPrevious={setCursor}
              />
            ) : null}
          </CardContent>
        </CardFrame>
      </div>
      <ConsoleDrawer
        title={drawer?.name || drawer?.email || ""}
        description="User, workspace, billing, and usage detail"
        open={Boolean(drawer)}
        onClose={() => setDrawer(null)}
      >
        {drawer ? (
          <div className="coss-stack">
            <div className="coss-grid-2">
              <DetailMetric label="Email" value={drawer.email} />
              <DetailMetric label="Provider" value={drawer.provider} />
              <DetailMetric label="Last login" value={drawer.lastLoginLabel} />
              <DetailMetric label="Services" value={drawer.usage.serviceCountLabel} />
              <DetailMetric
                label="Workspace"
                value={adminValue(drawer.workspace?.tenantName, messages.unavailable)}
              />
              <DetailMetric
                label="Default project"
                value={adminValue(
                  drawer.workspace?.defaultProjectName,
                  messages.unavailable,
                )}
              />
            </div>
            <Card className="coss-card--muted">
              <CardContent className="coss-stack-sm">
                <span className="coss-help">Billing</span>
                <strong>{drawer.billing.limitLabel}</strong>
                <span className="coss-help">
                  {adminValue(
                    drawer.billing.balanceLabel ?? drawer.billing.statusLabel,
                    messages.noBalanceData,
                  )}
                </span>
                {drawer.billing.loadError ? (
                  <Alert variant="warning" role="status">
                    <AlertTitle>{messages.billingSyncError}</AlertTitle>
                    <AlertDescription>{drawer.billing.loadError}</AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </ConsoleDrawer>
      <ConfirmationDialog
        title={operation?.title ?? ""}
        description={operation?.description ?? ""}
        open={Boolean(operation)}
        confirmDisabled={operating}
        confirmLabel={operation?.confirmLabel ?? "Confirm"}
        confirmLoading={operating}
        onConfirm={() => {
          void confirmOperation();
        }}
        onClose={() => {
          if (!operating) {
            setOperation(null);
          }
        }}
      />
    </>
  );
}
