"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { StatusBadge } from "@/components/console/status-badge";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/ui/cx";

type AdminUserView = {
  canBlock: boolean;
  canDelete: boolean;
  canUnblock: boolean;
  email: string;
  isAdmin: boolean;
  lastLoginExact: string;
  lastLoginLabel: string;
  name: string;
  provider: string;
  serviceCount: number;
  status: "active" | "blocked" | "deleted";
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

function AdminActionButton({
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
        busy && "is-busy",
        blocked && "is-blocked",
        className,
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
    action: "block" | "unblock" | "delete",
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

    setBusyAction(`${action}:${user.email}`);

    try {
      const endpoint =
        action === "delete"
          ? `/api/admin/users/${encodeURIComponent(user.email)}`
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
      <table className="fg-console-table">
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
                <div className="fg-console-table__stack">
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                </div>
              </td>
              <td>
                <div className="fg-console-toolbar">
                  <StatusBadge tone={user.statusTone}>{user.status}</StatusBadge>
                  {user.isAdmin ? <StatusBadge tone="info">admin</StatusBadge> : null}
                </div>
              </td>
              <td>
                <div className="fg-console-table__stack">
                  <strong>{user.provider}</strong>
                  <span>{user.verified ? "verified" : "unverified"}</span>
                </div>
              </td>
              <td>{user.tenantLabel}</td>
              <td>{user.serviceCount}</td>
              <td>
                <div className="fg-console-table__stack">
                  <strong>{user.lastLoginLabel}</strong>
                  <span>{user.lastLoginExact}</span>
                </div>
              </td>
              <td>
                <div className="fg-console-toolbar">
                  {user.canBlock ? (
                    <AdminActionButton
                      blocked={Boolean(
                        busyAction && busyAction !== `block:${user.email}`,
                      )}
                      busy={busyAction === `block:${user.email}`}
                      label="Block"
                      onClick={() => {
                        void handleModeration(user, "block");
                      }}
                    />
                  ) : null}
                  {user.canUnblock ? (
                    <AdminActionButton
                      blocked={Boolean(
                        busyAction && busyAction !== `unblock:${user.email}`,
                      )}
                      busy={busyAction === `unblock:${user.email}`}
                      label="Unblock"
                      onClick={() => {
                        void handleModeration(user, "unblock");
                      }}
                    />
                  ) : null}
                  {user.canDelete ? (
                    <AdminActionButton
                      blocked={Boolean(
                        busyAction && busyAction !== `delete:${user.email}`,
                      )}
                      busy={busyAction === `delete:${user.email}`}
                      className="is-danger"
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
