"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";

import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { StatusBadge } from "@/components/console/status-badge";
import { Button, InlineButton } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Panel, PanelSection, PanelTitle } from "@/components/ui/panel";
import {
  clampSteppedValue,
  SteppedSliderField,
} from "@/components/ui/stepped-slider-field";
import { useToast } from "@/components/ui/toast";
import type { ConsoleTone } from "@/lib/console/types";

type AdminUserBillingView = {
  balanceLabel: string | null;
  balanceMicroCents: number | null;
  committedStorageGibibytes: number | null;
  cpuMillicores: number | null;
  limitLabel: string;
  loadError: string | null;
  memoryMebibytes: number | null;
  monthlyEstimateLabel: string | null;
  priceBook: {
    cpuMicroCentsPerMillicoreHour: number;
    currency: string;
    hoursPerMonth: number;
    memoryMicroCentsPerMibHour: number;
    storageMicroCentsPerGibHour: number;
  } | null;
  storageGibibytes: number | null;
  statusLabel: string | null;
  statusReason: string | null;
  statusTone: ConsoleTone;
  tenantId: string | null;
};

type AdminUserView = {
  billing: AdminUserBillingView;
  canBlock: boolean;
  canDemoteAdmin: boolean;
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
  statusTone: ConsoleTone;
  usage: AdminUserServiceUsageView;
  verified: boolean;
};

type AdminUserServiceUsageView = {
  cpuLabel: string;
  diskLabel: string;
  memoryLabel: string;
  serviceCount: number;
  serviceCountLabel: string;
};

const MICRO_CENTS_PER_CENT = 1_000_000;
const MICRO_CENTS_PER_DOLLAR = 100_000_000;
const MILLICORES_PER_VCPU = 1000;
const MEBIBYTES_PER_GIB = 1024;
const CPU_STEP_CORES = 0.5;
const MEMORY_STEP_GIB = 0.25;
const STORAGE_STEP_GIB = 1;
const CPU_SLIDER_MAX_CORES = 2;
const MEMORY_SLIDER_MAX_GIB = 4;
const STORAGE_SLIDER_MAX_GIB = 30;
const CPU_SLIDER_MAX_MILLICORES = CPU_SLIDER_MAX_CORES * MILLICORES_PER_VCPU;
const MEMORY_SLIDER_MAX_MEBIBYTES = MEMORY_SLIDER_MAX_GIB * MEBIBYTES_PER_GIB;
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

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

function buildDialogIdFragment(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "user";
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

function formatCompactNumber(value: number, digits = 1) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(1, digits),
  }).format(value);
}

function formatCurrencyFromMicroCents(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value / MICRO_CENTS_PER_DOLLAR);
}

function formatBalanceDraftFromMicroCents(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "0.00";
  }

  return Math.max(value / MICRO_CENTS_PER_DOLLAR, 0).toFixed(2);
}

function parseDollarAmountToCents(value: string) {
  const trimmed = value.trim();

  if (!trimmed || !/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }

  const [whole, fraction = ""] = trimmed.split(".");
  const wholeDollars = Number(whole);

  if (!Number.isSafeInteger(wholeDollars)) {
    return null;
  }

  return wholeDollars * 100 + Number(`${fraction}00`.slice(0, 2));
}

function formatCPU(cpuMillicores: number) {
  const cores = cpuMillicores / MILLICORES_PER_VCPU;

  if (cpuMillicores === 0) {
    return "0 cpu";
  }

  const digits = Number.isInteger(cores) ? 0 : cores >= 10 ? 1 : 2;
  return `${formatCompactNumber(cores, digits)} cpu`;
}

function formatMemory(memoryMebibytes: number) {
  const gib = memoryMebibytes / MEBIBYTES_PER_GIB;
  return `${formatCompactNumber(gib, Number.isInteger(gib) ? 0 : 2)} GiB`;
}

function formatStorage(storageGibibytes: number) {
  return `${formatCompactNumber(storageGibibytes, Number.isInteger(storageGibibytes) ? 0 : 2)} GiB`;
}

function clampQuotaCpuMillicores(value: number) {
  return Math.round(
    clampSteppedValue({
      max: CPU_SLIDER_MAX_CORES,
      step: CPU_STEP_CORES,
      value: value / MILLICORES_PER_VCPU,
    }) * MILLICORES_PER_VCPU,
  );
}

function clampQuotaMemoryMebibytes(value: number) {
  return Math.round(
    clampSteppedValue({
      max: MEMORY_SLIDER_MAX_GIB,
      step: MEMORY_STEP_GIB,
      value: value / MEBIBYTES_PER_GIB,
    }) * MEBIBYTES_PER_GIB,
  );
}

function clampQuotaStorageGibibytes(value: number) {
  return Math.round(
    clampSteppedValue({
      max: STORAGE_SLIDER_MAX_GIB,
      step: STORAGE_STEP_GIB,
      value,
    }),
  );
}

function formatResourceSpec(spec: {
  cpuMillicores: number;
  memoryMebibytes: number;
  storageGibibytes?: number;
}) {
  const parts = [formatCPU(spec.cpuMillicores), formatMemory(spec.memoryMebibytes)];

  if (spec.storageGibibytes !== undefined) {
    parts.push(formatStorage(spec.storageGibibytes));
  }

  return parts.join(" / ");
}

function estimateMonthlyMicroCents(
  spec: {
    cpuMillicores: number;
    memoryMebibytes: number;
    storageGibibytes?: number;
  },
  priceBook: NonNullable<AdminUserBillingView["priceBook"]>,
  committedStorageGibibytes = 0,
) {
  if (spec.cpuMillicores <= 0 || spec.memoryMebibytes <= 0) {
    return 0;
  }

  return (
    spec.cpuMillicores * priceBook.cpuMicroCentsPerMillicoreHour +
    spec.memoryMebibytes * priceBook.memoryMicroCentsPerMibHour +
    Math.max(spec.storageGibibytes ?? 0, committedStorageGibibytes) *
      priceBook.storageMicroCentsPerGibHour
  ) * priceBook.hoursPerMonth;
}

function canEditQuota(user: AdminUserView) {
  return Boolean(
    user.billing.tenantId &&
      user.billing.priceBook &&
      user.billing.cpuMillicores !== null &&
      user.billing.memoryMebibytes !== null &&
      user.billing.storageGibibytes !== null &&
      !user.billing.loadError,
  );
}

export function AdminUserManager({
  users,
  onRefresh,
}: {
  users: AdminUserView[];
  onRefresh?: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const { showToast } = useToast();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [editingQuotaEmail, setEditingQuotaEmail] = useState<string | null>(null);
  const [quotaCpu, setQuotaCpu] = useState(0);
  const [quotaMemory, setQuotaMemory] = useState(0);
  const [quotaStorage, setQuotaStorage] = useState(0);
  const [balanceAmount, setBalanceAmount] = useState("0.00");
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const quotaDialogRef = useRef<HTMLDivElement | null>(null);
  const quotaDialogBackdropPressStartedRef = useRef(false);
  const quotaDialogReturnFocusRef = useRef<HTMLElement | null>(null);
  const editingQuotaUser = editingQuotaEmail
    ? users.find((candidate) => candidate.email === editingQuotaEmail) ?? null
    : null;
  const quotaCpuCores = quotaCpu / MILLICORES_PER_VCPU;
  const quotaMemoryGib = quotaMemory / MEBIBYTES_PER_GIB;
  const committedStorageGibibytes = editingQuotaUser?.billing.committedStorageGibibytes ?? 0;
  const previewPriceBook = editingQuotaUser?.billing.priceBook ?? null;
  const previewSpec = {
    cpuMillicores: quotaCpu,
    memoryMebibytes: quotaMemory,
    storageGibibytes: quotaStorage,
  };
  const previewBilledSpec = {
    ...previewSpec,
    storageGibibytes:
      quotaCpu > 0 && quotaMemory > 0
        ? Math.max(quotaStorage, committedStorageGibibytes)
        : 0,
  };
  const previewMonthly =
    previewPriceBook && editingQuotaUser
      ? estimateMonthlyMicroCents(
          previewSpec,
          previewPriceBook,
          committedStorageGibibytes,
        )
      : null;
  const currentBalanceMicroCents = editingQuotaUser?.billing.balanceMicroCents ?? null;
  const currentBalanceRoundedCents =
    currentBalanceMicroCents !== null
      ? Math.round(currentBalanceMicroCents / MICRO_CENTS_PER_CENT)
      : 0;
  const parsedBalanceCents = editingQuotaUser ? parseDollarAmountToCents(balanceAmount) : null;
  const quotaDirty = Boolean(
    editingQuotaUser &&
      canEditQuota(editingQuotaUser) &&
      (quotaCpu !== editingQuotaUser.billing.cpuMillicores ||
        quotaMemory !== editingQuotaUser.billing.memoryMebibytes ||
        quotaStorage !== editingQuotaUser.billing.storageGibibytes),
  );
  const balanceDirty = Boolean(
    editingQuotaUser &&
      canEditQuota(editingQuotaUser) &&
      parsedBalanceCents !== null &&
      parsedBalanceCents !== currentBalanceRoundedCents,
  );
  const quotaExceedsUiCap = Boolean(
    editingQuotaUser &&
      ((editingQuotaUser.billing.cpuMillicores ?? 0) > CPU_SLIDER_MAX_MILLICORES ||
        (editingQuotaUser.billing.memoryMebibytes ?? 0) > MEMORY_SLIDER_MAX_MEBIBYTES ||
        (editingQuotaUser.billing.storageGibibytes ?? 0) > STORAGE_SLIDER_MAX_GIB),
  );
  const quotaBusy = Boolean(editingQuotaUser && busyAction === `quota:${editingQuotaUser.email}`);
  const quotaBlocked = Boolean(
    editingQuotaUser && busyAction && busyAction !== `quota:${editingQuotaUser.email}`,
  );
  const balanceBusy = Boolean(editingQuotaUser && busyAction === `balance:${editingQuotaUser.email}`);
  const balanceBlocked = Boolean(
    editingQuotaUser && busyAction && busyAction !== `balance:${editingQuotaUser.email}`,
  );
  const isBillingDialogBusy = quotaBusy || balanceBusy;

  function refreshPage() {
    if (onRefresh) {
      onRefresh();
      return;
    }

    router.refresh();
  }

  useEffect(() => {
    if (!editingQuotaEmail || editingQuotaUser) {
      return;
    }

    setEditingQuotaEmail(null);
    setQuotaCpu(0);
    setQuotaMemory(0);
    setQuotaStorage(0);
    setBalanceAmount("0.00");
    setQuotaError(null);
    setBalanceError(null);
    quotaDialogReturnFocusRef.current = null;
  }, [editingQuotaEmail, editingQuotaUser]);

  useEffect(() => {
    if (!editingQuotaUser) {
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

    const frame = window.requestAnimationFrame(() => {
      readFocusableElements(quotaDialogRef.current)[0]?.focus();
    });

    return () => {
      quotaDialogBackdropPressStartedRef.current = false;
      window.cancelAnimationFrame(frame);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [editingQuotaUser]);

  function closeQuotaEditor() {
    setEditingQuotaEmail(null);
    setQuotaCpu(0);
    setQuotaMemory(0);
    setQuotaStorage(0);
    setBalanceAmount("0.00");
    setQuotaError(null);
    setBalanceError(null);

    const returnFocusTarget = quotaDialogReturnFocusRef.current;
    quotaDialogReturnFocusRef.current = null;

    if (returnFocusTarget && typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        if (returnFocusTarget.isConnected) {
          returnFocusTarget.focus();
        }
      });
    }
  }

  function openQuotaEditor(user: AdminUserView) {
    if (!canEditQuota(user)) {
      return;
    }

    if (editingQuotaEmail === user.email) {
      return;
    }

    quotaDialogReturnFocusRef.current =
      typeof document !== "undefined" && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setEditingQuotaEmail(user.email);
    setQuotaCpu(clampQuotaCpuMillicores(user.billing.cpuMillicores ?? 0));
    setQuotaMemory(clampQuotaMemoryMebibytes(user.billing.memoryMebibytes ?? 0));
    setQuotaStorage(clampQuotaStorageGibibytes(user.billing.storageGibibytes ?? 0));
    setBalanceAmount(formatBalanceDraftFromMicroCents(user.billing.balanceMicroCents));
    setQuotaError(null);
    setBalanceError(null);
  }

  function handleQuotaDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!editingQuotaUser) {
      return;
    }

    if (event.key === "Escape") {
      if (isBillingDialogBusy) {
        return;
      }

      event.preventDefault();
      closeQuotaEditor();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusableElements = readFocusableElements(quotaDialogRef.current);

    if (!focusableElements.length) {
      event.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const activeInsideDialog = activeElement
      ? quotaDialogRef.current?.contains(activeElement)
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

  function handleQuotaDialogBackdropPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (isBillingDialogBusy) {
      quotaDialogBackdropPressStartedRef.current = false;
      return;
    }

    quotaDialogBackdropPressStartedRef.current = event.target === event.currentTarget;
  }

  function handleQuotaDialogBackdropClick(event: ReactMouseEvent<HTMLDivElement>) {
    const shouldClose =
      !isBillingDialogBusy &&
      quotaDialogBackdropPressStartedRef.current &&
      event.target === event.currentTarget;

    quotaDialogBackdropPressStartedRef.current = false;

    if (!shouldClose) {
      return;
    }

    closeQuotaEditor();
  }

  async function handleModeration(
    user: AdminUserView,
    action: "block" | "unblock" | "delete" | "promote" | "demote",
  ) {
    if (busyAction) {
      return;
    }

    if (action === "delete") {
      const confirmed = await confirm({
        confirmLabel: "Delete user",
        description: `${user.email} will be removed from Fugue.`,
        title: "Delete user?",
      });

      if (!confirmed) {
        return;
      }
    }

    if (action === "promote") {
      const confirmed = await confirm({
        confirmLabel: "Make admin",
        description:
          user.status.toLowerCase() === "blocked"
            ? `${user.email} will become an admin and their access will be restored.`
            : `${user.email} will gain workspace admin access.`,
        eyebrow: "Privilege change",
        title: "Promote user to admin?",
        variant: "primary",
      });

      if (!confirmed) {
        return;
      }
    }

    if (action === "demote") {
      const confirmed = await confirm({
        cancelLabel: "Keep admin",
        confirmLabel: "Remove admin",
        description: `${user.email} will lose admin access and stay in the workspace as a regular user.`,
        eyebrow: "Privilege change",
        title: "Remove admin access?",
        variant: "danger",
      });

      if (!confirmed) {
        return;
      }
    }

    setBusyAction(`${action}:${user.email}`);

    try {
      const endpoint =
        action === "delete"
          ? `/api/admin/users/${encodeURIComponent(user.email)}`
          : action === "promote" || action === "demote"
            ? `/api/admin/users/${encodeURIComponent(user.email)}/admin`
            : `/api/admin/users/${encodeURIComponent(user.email)}/${action}`;
      const method =
        action === "delete" || action === "demote" ? "DELETE" : "POST";

      await requestJson(endpoint, {
        method,
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
              : action === "demote"
                ? "Admin access removed."
              : "User deleted.",
        variant: "success",
      });
      refreshPage();
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleQuotaSubmit(user: AdminUserView, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busyAction || !canEditQuota(user)) {
      return;
    }

    setBusyAction(`quota:${user.email}`);
    setQuotaError(null);

    try {
      await requestJson<{ billing: unknown }>(
        `/api/admin/users/${encodeURIComponent(user.email)}/billing`,
        {
          body: JSON.stringify({
            managedCap: {
              cpuMillicores: quotaCpu,
              memoryMebibytes: quotaMemory,
              storageGibibytes: quotaStorage,
            },
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );

      closeQuotaEditor();
      showToast({
        message: "Managed limit updated.",
        variant: "success",
      });
      refreshPage();
    } catch (error) {
      const message = readErrorMessage(error);
      setQuotaError(message);
      showToast({
        message,
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleBalanceSubmit(user: AdminUserView, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busyAction || !canEditQuota(user)) {
      return;
    }

    const parsedBalanceCents = parseDollarAmountToCents(balanceAmount);

    if (parsedBalanceCents === null) {
      const message = "Enter a non-negative USD amount with up to two decimal places.";
      setBalanceError(message);
      showToast({
        message,
        variant: "error",
      });
      return;
    }

    setBusyAction(`balance:${user.email}`);
    setBalanceError(null);

    try {
      await requestJson<{ billing: unknown }>(
        `/api/admin/users/${encodeURIComponent(user.email)}/billing`,
        {
          body: JSON.stringify({
            balanceCents: parsedBalanceCents,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );

      closeQuotaEditor();
      showToast({
        message: "Balance updated.",
        variant: "success",
      });
      refreshPage();
    } catch (error) {
      const message = readErrorMessage(error);
      setBalanceError(message);
      showToast({
        message,
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

  const quotaDialogIdBase = editingQuotaUser
    ? buildDialogIdFragment(editingQuotaUser.email)
    : null;
  const quotaDialogTitleId = quotaDialogIdBase
    ? `admin-user-billing-title-${quotaDialogIdBase}`
    : undefined;
  const quotaDialogDescriptionId = quotaDialogIdBase
    ? `admin-user-billing-description-${quotaDialogIdBase}`
    : undefined;

  return (
    <>
      <div className="fg-console-table-wrap">
        <table className="fg-console-table fg-console-table--admin fg-console-table--users">
          <colgroup>
            <col className="fg-console-table__col fg-console-table__col--user" />
            <col className="fg-console-table__col fg-console-table__col--status" />
            <col className="fg-console-table__col fg-console-table__col--provider" />
            <col className="fg-console-table__col fg-console-table__col--balance" />
            <col className="fg-console-table__col fg-console-table__col--billing" />
            <col className="fg-console-table__col fg-console-table__col--services" />
            <col className="fg-console-table__col fg-console-table__col--last-login" />
            <col className="fg-console-table__col fg-console-table__col--user-actions" />
          </colgroup>
          <thead>
            <tr>
              <th>User</th>
              <th>Status</th>
              <th>Provider</th>
              <th>
                <span className="fg-admin-user-column-head">
                  <span className="fg-admin-user-column-head__label">Balance</span>
                  <span className="fg-admin-user-column-head__meta">Prepaid / status</span>
                </span>
              </th>
              <th>
                <span className="fg-admin-user-column-head">
                  <span className="fg-admin-user-column-head__label">Managed limit</span>
                  <span className="fg-admin-user-column-head__meta">
                    CPU / Memory / Storage / Monthly
                  </span>
                </span>
              </th>
              <th>
                <span className="fg-admin-user-column-head">
                  <span className="fg-admin-user-column-head__label">Service usage</span>
                  <span className="fg-admin-user-column-head__meta">
                    Services / CPU / Memory / Disk
                  </span>
                </span>
              </th>
              <th>Last login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isQuotaEditable = canEditQuota(user);
              const billingActionBusy =
                busyAction === `quota:${user.email}` || busyAction === `balance:${user.email}`;
              const billingActionBlocked = Boolean(
                busyAction &&
                  busyAction !== `quota:${user.email}` &&
                  busyAction !== `balance:${user.email}`,
              );
              const billingCpuLabel =
                user.billing.cpuMillicores !== null
                  ? formatCPU(user.billing.cpuMillicores)
                  : "No stats";
              const billingMemoryLabel =
                user.billing.memoryMebibytes !== null
                  ? formatMemory(user.billing.memoryMebibytes)
                  : "No stats";
              const billingStorageLabel =
                user.billing.storageGibibytes !== null
                  ? formatStorage(user.billing.storageGibibytes)
                  : "No stats";
              const billingMonthlyLabel = user.billing.monthlyEstimateLabel
                ? `${user.billing.monthlyEstimateLabel}/mo`
                : user.billing.loadError
                  ? "Unavailable"
                  : "No estimate";
              const billingStatusLabel = user.billing.statusLabel
                ? user.billing.statusLabel
                : user.billing.loadError
                  ? "Unavailable"
                  : "No billing";
              const balanceValueLabel =
                user.billing.balanceLabel ??
                (user.billing.loadError
                  ? "Unavailable"
                  : user.billing.tenantId
                    ? "No balance"
                    : "No workspace");
              const balanceMetaLabel = user.billing.statusLabel
                ? user.billing.statusLabel
                : user.billing.loadError
                  ? "Billing unavailable"
                  : user.billing.tenantId
                    ? "No billing"
                    : "No workspace";
              const managedLimitSummaryLabel = [
                `CPU ${billingCpuLabel}`,
                `Memory ${billingMemoryLabel}`,
                `Storage ${billingStorageLabel}`,
                `Monthly ${billingMonthlyLabel}`,
              ].join(" / ");
              const balanceTitle = [
                `Balance ${balanceValueLabel}`,
                balanceMetaLabel,
                user.billing.statusReason,
                user.billing.loadError,
              ]
                .filter(Boolean)
                .join(" / ");
              const managedLimitTitle = [
                managedLimitSummaryLabel,
                `Limit ${user.billing.limitLabel}`,
                user.billing.statusLabel ? `Status ${billingStatusLabel}` : null,
                user.billing.statusReason,
                user.billing.loadError,
              ]
                .filter(Boolean)
                .join(" / ");
              const balanceStatusContent = user.billing.statusLabel ? (
                <StatusBadge className="fg-admin-user-signal-badge" tone={user.billing.statusTone}>
                  {user.billing.statusLabel}
                </StatusBadge>
              ) : (
                <span className="fg-admin-user-signal__fallback">
                  {balanceMetaLabel}
                </span>
              );
              const usageSummaryLabel = [
                `Services ${user.usage.serviceCountLabel}`,
                `CPU ${user.usage.cpuLabel}`,
                `Memory ${user.usage.memoryLabel}`,
                `Disk ${user.usage.diskLabel}`,
              ].join(" / ");

              return (
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
                    <div className="fg-console-table__stack fg-admin-user-balance" title={balanceTitle || undefined}>
                      <strong>{balanceValueLabel}</strong>
                      <div className="fg-admin-user-balance__meta">{balanceStatusContent}</div>
                    </div>
                  </td>
                  <td>
                    <div
                      className="fg-admin-user-billing"
                      title={managedLimitTitle || undefined}
                    >
                      <dl
                        aria-label={managedLimitSummaryLabel}
                        className="fg-admin-user-signal-strip fg-admin-user-signal-strip--values-only"
                      >
                        <div className="fg-admin-user-signal">
                          <dt>CPU</dt>
                          <dd>{billingCpuLabel}</dd>
                        </div>
                        <div className="fg-admin-user-signal">
                          <dt>Memory</dt>
                          <dd>{billingMemoryLabel}</dd>
                        </div>
                        <div className="fg-admin-user-signal">
                          <dt>Storage</dt>
                          <dd>{billingStorageLabel}</dd>
                        </div>
                        <div className="fg-admin-user-signal">
                          <dt>Monthly</dt>
                          <dd>{billingMonthlyLabel}</dd>
                        </div>
                      </dl>
                    </div>
                  </td>
                  <td>
                    <div className="fg-admin-user-usage" title={usageSummaryLabel}>
                      <dl
                        aria-label={usageSummaryLabel}
                        className="fg-admin-user-signal-strip fg-admin-user-signal-strip--values-only"
                      >
                        <div className="fg-admin-user-signal">
                          <dt>Services</dt>
                          <dd>{user.usage.serviceCountLabel}</dd>
                        </div>
                        <div className="fg-admin-user-signal">
                          <dt>CPU</dt>
                          <dd>{user.usage.cpuLabel}</dd>
                        </div>
                        <div className="fg-admin-user-signal">
                          <dt>Memory</dt>
                          <dd>{user.usage.memoryLabel}</dd>
                        </div>
                        <div className="fg-admin-user-signal">
                          <dt>Disk</dt>
                          <dd>{user.usage.diskLabel}</dd>
                        </div>
                      </dl>
                    </div>
                  </td>
                  <td>
                    <span title={user.lastLoginExact}>{user.lastLoginLabel}</span>
                  </td>
                  <td>
                    <div className="fg-console-toolbar">
                      {isQuotaEditable ? (
                        <InlineButton
                          blocked={billingActionBlocked}
                          busy={billingActionBusy}
                          busyLabel="Saving…"
                          label="Edit billing"
                          onClick={() => {
                            openQuotaEditor(user);
                          }}
                        />
                      ) : null}
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
                      {user.canDemoteAdmin ? (
                        <InlineButton
                          blocked={Boolean(
                            busyAction && busyAction !== `demote:${user.email}`,
                          )}
                          busy={busyAction === `demote:${user.email}`}
                          busyLabel="Updating…"
                          label="Remove admin"
                          onClick={() => {
                            void handleModeration(user, "demote");
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
              );
            })}
          </tbody>
        </table>
      </div>

      {editingQuotaUser ? (
        <div
          className="fg-console-dialog-backdrop"
          onClick={handleQuotaDialogBackdropClick}
          onPointerDown={handleQuotaDialogBackdropPointerDown}
        >
          <div
            aria-busy={isBillingDialogBusy || undefined}
            aria-describedby={quotaDialogDescriptionId}
            aria-labelledby={quotaDialogTitleId}
            aria-modal="true"
            className="fg-console-dialog-shell fg-admin-user-billing-dialog-shell"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={handleQuotaDialogKeyDown}
            ref={quotaDialogRef}
            role="dialog"
          >
            <Panel className="fg-console-dialog-panel">
              <PanelSection>
                <div className="fg-admin-user-billing-dialog__head">
                  <div className="fg-admin-user-billing-dialog__copy">
                    <p className="fg-label fg-panel__eyebrow">User billing</p>
                    <PanelTitle className="fg-console-dialog__title" id={quotaDialogTitleId}>
                      Edit billing
                    </PanelTitle>
                    <p
                      className="fg-admin-user-billing-dialog__meta"
                      id={quotaDialogDescriptionId}
                      title={`${editingQuotaUser.name} / ${editingQuotaUser.email}`}
                    >
                      {editingQuotaUser.name} / {editingQuotaUser.email}
                    </p>
                  </div>

                  {editingQuotaUser.billing.statusLabel || editingQuotaUser.billing.balanceLabel ? (
                    <div className="fg-billing-status-row">
                      {editingQuotaUser.billing.statusLabel ? (
                        <StatusBadge tone={editingQuotaUser.billing.statusTone}>
                          {editingQuotaUser.billing.statusLabel}
                        </StatusBadge>
                      ) : null}
                      {editingQuotaUser.billing.balanceLabel ? (
                        <StatusBadge tone="neutral">
                          {editingQuotaUser.billing.balanceLabel} balance
                        </StatusBadge>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </PanelSection>

              <PanelSection className="fg-console-dialog__body">
                <div className="fg-admin-user-billing-dialog">
                  {editingQuotaUser.billing.statusReason ? (
                    <InlineAlert variant="info">{editingQuotaUser.billing.statusReason}</InlineAlert>
                  ) : null}
                  {quotaExceedsUiCap ? (
                    <InlineAlert variant="warning">
                      The saved limit is above the temporary control cap of 2 cpu / 4 GiB /
                      30 GiB storage. Save a new limit here to bring the user back inside the
                      current range.
                    </InlineAlert>
                  ) : null}

                  <div className="fg-admin-user-billing-dialog__sections">
                    <section className="fg-admin-user-billing-dialog__section">
                      <div className="fg-admin-user-billing-dialog__section-head">
                        <strong>Managed limit</strong>
                        <span>{editingQuotaUser.billing.limitLabel}</span>
                      </div>

                      {quotaError ? <InlineAlert variant="error">{quotaError}</InlineAlert> : null}

                      <form
                        className="fg-settings-form fg-admin-user-quota-form"
                        noValidate
                        onSubmit={(event) => {
                          void handleQuotaSubmit(editingQuotaUser, event);
                        }}
                      >
                        <div className="fg-billing-form__grid">
                          <SteppedSliderField
                            disabled={quotaBusy || quotaBlocked}
                            hint={`Adjust from 0 to ${CPU_SLIDER_MAX_CORES} cpu in ${CPU_STEP_CORES} cpu steps.`}
                            id={`quota-cpu-${editingQuotaUser.email}`}
                            label="CPU limit"
                            max={CPU_SLIDER_MAX_CORES}
                            maxLabel={formatCPU(Math.round(CPU_SLIDER_MAX_CORES * MILLICORES_PER_VCPU))}
                            minLabel={formatCPU(0)}
                            name="quotaCpu"
                            onChange={(nextValue) => {
                              setQuotaCpu(
                                clampQuotaCpuMillicores(nextValue * MILLICORES_PER_VCPU),
                              );
                              if (quotaError) {
                                setQuotaError(null);
                              }
                            }}
                            step={CPU_STEP_CORES}
                            value={quotaCpuCores}
                            valueLabel={formatCPU(quotaCpu)}
                          />

                          <SteppedSliderField
                            disabled={quotaBusy || quotaBlocked}
                            hint={`Adjust from 0 to ${MEMORY_SLIDER_MAX_GIB} GiB in ${MEMORY_STEP_GIB} GiB steps.`}
                            id={`quota-memory-${editingQuotaUser.email}`}
                            label="Memory limit"
                            max={MEMORY_SLIDER_MAX_GIB}
                            maxLabel={formatMemory(
                              Math.round(MEMORY_SLIDER_MAX_GIB * MEBIBYTES_PER_GIB),
                            )}
                            minLabel={formatMemory(0)}
                            name="quotaMemory"
                            onChange={(nextValue) => {
                              setQuotaMemory(
                                clampQuotaMemoryMebibytes(nextValue * MEBIBYTES_PER_GIB),
                              );
                              if (quotaError) {
                                setQuotaError(null);
                              }
                            }}
                            step={MEMORY_STEP_GIB}
                            value={quotaMemoryGib}
                            valueLabel={formatMemory(quotaMemory)}
                          />

                          <SteppedSliderField
                            disabled={quotaBusy || quotaBlocked}
                            id={`quota-storage-${editingQuotaUser.email}`}
                            label="Storage limit"
                            max={STORAGE_SLIDER_MAX_GIB}
                            maxLabel={formatStorage(STORAGE_SLIDER_MAX_GIB)}
                            minLabel={formatStorage(0)}
                            name="quotaStorage"
                            onChange={(nextValue) => {
                              setQuotaStorage(clampQuotaStorageGibibytes(nextValue));
                              if (quotaError) {
                                setQuotaError(null);
                              }
                            }}
                            step={STORAGE_STEP_GIB}
                            value={quotaStorage}
                            valueLabel={formatStorage(quotaStorage)}
                          />
                        </div>

                        <div className="fg-admin-user-quota-form__footer">
                          <div className="fg-billing-estimate">
                            <strong>
                              {previewMonthly !== null && previewPriceBook
                                ? `${formatCurrencyFromMicroCents(
                                    previewMonthly,
                                    previewPriceBook.currency,
                                  )} / month`
                                : "Monthly preview unavailable"}
                            </strong>
                            <p>
                              {quotaCpu === 0 || quotaMemory === 0
                                ? "Set CPU or memory to 0 to pause managed billing."
                                : previewBilledSpec.storageGibibytes !== quotaStorage
                                  ? `${formatResourceSpec(previewSpec)} limit. Billed as ${formatResourceSpec(previewBilledSpec)} until live storage shrinks.`
                                  : formatResourceSpec(previewSpec)}
                            </p>
                          </div>

                          <div className="fg-admin-user-quota-form__actions">
                            <Button
                              disabled={quotaBlocked || !quotaDirty}
                              loading={quotaBusy}
                              loadingLabel="Saving…"
                              type="submit"
                              variant="primary"
                            >
                              Save limit
                            </Button>
                          </div>
                        </div>
                      </form>
                    </section>

                    <section className="fg-admin-user-billing-dialog__section">
                      <div className="fg-admin-user-billing-dialog__section-head">
                        <strong>Balance</strong>
                        <span>{editingQuotaUser.billing.balanceLabel ?? "No balance"}</span>
                      </div>

                      <form
                        className="fg-settings-form fg-admin-user-balance-form"
                        noValidate
                        onSubmit={(event) => {
                          void handleBalanceSubmit(editingQuotaUser, event);
                        }}
                      >
                        <div className="fg-admin-user-balance-form__row">
                          <FormField
                            error={balanceError ?? undefined}
                            htmlFor={`balance-${editingQuotaUser.email}`}
                            label="Set balance"
                            optionalLabel="USD"
                          >
                            <input
                              className="fg-input"
                              id={`balance-${editingQuotaUser.email}`}
                              inputMode="decimal"
                              onChange={(event) => {
                                setBalanceAmount(event.target.value);
                                if (balanceError) {
                                  setBalanceError(null);
                                }
                              }}
                              placeholder="10.00"
                              type="text"
                              value={balanceAmount}
                            />
                          </FormField>

                          <div className="fg-admin-user-quota-form__actions">
                            <Button
                              disabled={
                                balanceBlocked || !balanceDirty || parsedBalanceCents === null
                              }
                              loading={balanceBusy}
                              loadingLabel="Saving…"
                              type="submit"
                              variant="primary"
                            >
                              Save balance
                            </Button>
                          </div>
                        </div>
                      </form>
                    </section>
                  </div>
                </div>
              </PanelSection>

              <PanelSection className="fg-console-dialog__footer">
                <div className="fg-console-dialog__actions">
                  <Button
                    disabled={isBillingDialogBusy}
                    onClick={closeQuotaEditor}
                    type="button"
                    variant="secondary"
                  >
                    Close
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
