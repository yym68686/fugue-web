"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { StatusBadge } from "@/components/console/status-badge";
import { InlineButton } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type AdminUserView = {
  canBlock: boolean;
  canDelete: boolean;
  canPromoteToAdmin: boolean;
  canUnblock: boolean;
  email: string;
  isAdmin: boolean;
  lastLoginExact: string;
  lastLoginLabel: string;
  name: string;
  provider: string;
  serviceCount: number;
  status: string;
  statusTone: "positive" | "warning" | "danger" | "info" | "neutral";
  tenantLabel: string;
  verified: boolean;
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

export function AdminUserManager({
  users,
}: {
  users: AdminUserView[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busyAction, setBusyAction] = useState<string | null>(null);

  async function handleModeration(
    user: AdminUserView,
    action: "block" | "unblock" | "delete" | "promote",
  ) {
    if (busyAction) {
      return;
    }

    if (action === "delete") {
      const confirmed = window.confirm(`Delete ${user.email}?`);

      if (!confirmed) {
        return;
      }
    }

    if (action === "promote") {
      const confirmed = window.confirm(
        user.status.toLowerCase() === "blocked"
          ? `Make ${user.email} an admin? This will also restore their access.`
          : `Make ${user.email} an admin?`,
      );

      if (!confirmed) {
        return;
      }
    }

    setBusyAction(`${action}:${user.email}`);

    try {
      const endpoint =
        action === "delete"
          ? `/api/admin/users/${encodeURIComponent(user.email)}`
          : action === "promote"
            ? `/api/admin/users/${encodeURIComponent(user.email)}/admin`
          : `/api/admin/users/${encodeURIComponent(user.email)}/${action}`;

      await requestJson(endpoint, {
        method: action === "delete" ? "DELETE" : "POST",
      });

      showToast({
        message:
          action === "block"
            ? "User blocked."
            : action === "unblock"
              ? "User unblocked."
              : action === "promote"
                ? user.status.toLowerCase() === "blocked"
                  ? "User promoted to admin and restored."
                  : "User promoted to admin."
              : "User deleted.",
        variant: "success",
      });
      startTransition(() => {
        router.refresh();
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

  if (!users.length) {
    return (
      <ConsoleEmptyState
        description="No product users have signed in yet."
        title="No users yet"
      />
    );
  }

  return (
    <div className="fg-console-table-wrap">
      <table className="fg-console-table fg-console-table--admin fg-console-table--users">
        <colgroup>
          <col className="fg-console-table__col fg-console-table__col--user" />
          <col className="fg-console-table__col fg-console-table__col--status" />
          <col className="fg-console-table__col fg-console-table__col--provider" />
          <col className="fg-console-table__col fg-console-table__col--tenant" />
          <col className="fg-console-table__col fg-console-table__col--services" />
          <col className="fg-console-table__col fg-console-table__col--last-login" />
          <col className="fg-console-table__col fg-console-table__col--user-actions" />
        </colgroup>
        <thead>
          <tr>
            <th>User</th>
            <th>Status</th>
            <th>Provider</th>
            <th>Tenant</th>
            <th>Services</th>
            <th>Last login</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.email}>
              <td>
                <div
                  className="fg-console-table__pair"
                  title={`${user.name} / ${user.email}`}
                >
                  <strong>{user.name}</strong>
                  <span>/ {user.email}</span>
                </div>
              </td>
              <td>
                <div className="fg-console-toolbar">
                  <StatusBadge tone={user.statusTone}>{user.status}</StatusBadge>
                  {user.isAdmin ? <StatusBadge tone="info">Admin</StatusBadge> : null}
                </div>
              </td>
              <td>
                <div className="fg-console-table__pair">
                  <strong>{user.provider}</strong>
                  <span>/ {user.verified ? "Verified" : "Unverified"}</span>
                </div>
              </td>
              <td>
                <span className="fg-console-table__clip" title={user.tenantLabel}>
                  {user.tenantLabel}
                </span>
              </td>
              <td>{user.serviceCount}</td>
              <td>
                <span title={user.lastLoginExact}>{user.lastLoginLabel}</span>
              </td>
              <td>
                <div className="fg-console-toolbar">
                  {user.canPromoteToAdmin ? (
                    <InlineButton
                      blocked={Boolean(
                        busyAction && busyAction !== `promote:${user.email}`,
                      )}
                      busy={busyAction === `promote:${user.email}`}
                      busyLabel="Promoting…"
                      label="Make admin"
                      onClick={() => {
                        void handleModeration(user, "promote");
                      }}
                    />
                  ) : null}
                  {user.canBlock ? (
                    <InlineButton
                      blocked={Boolean(
                        busyAction && busyAction !== `block:${user.email}`,
                      )}
                      busy={busyAction === `block:${user.email}`}
                      busyLabel="Blocking…"
                      label="Block"
                      onClick={() => {
                        void handleModeration(user, "block");
                      }}
                    />
                  ) : null}
                  {user.canUnblock ? (
                    <InlineButton
                      blocked={Boolean(
                        busyAction && busyAction !== `unblock:${user.email}`,
                      )}
                      busy={busyAction === `unblock:${user.email}`}
                      busyLabel="Unblocking…"
                      label="Unblock"
                      onClick={() => {
                        void handleModeration(user, "unblock");
                      }}
                    />
                  ) : null}
                  {user.canDelete ? (
                    <InlineButton
                      blocked={Boolean(
                        busyAction && busyAction !== `delete:${user.email}`,
                      )}
                      busy={busyAction === `delete:${user.email}`}
                      busyLabel="Deleting…"
                      danger
                      label="Delete"
                      onClick={() => {
                        void handleModeration(user, "delete");
                      }}
                    />
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
