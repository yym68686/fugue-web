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
import { useI18n } from "@/components/providers/i18n-provider";
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
  imageLabel: string;
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
type Translator = ReturnType<typeof useI18n>["t"];
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function readErrorMessage(error: unknown, t: Translator) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return t("Request failed.");
}

async function requestJson<T>(
  input: RequestInfo,
  init: RequestInit | undefined,
  t: Translator,
) {
  const response = await fetch(input, init);
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!data) {
    throw new Error(t("Empty response."));
  }

  if (!response.ok) {
    throw new Error(data.error || t("Request failed."));
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

function readLocalizedUsageValue(value: string, t: Translator) {
  if (!value) {
    return value;
  }

  if (value === "No stats") {
    return t("No stats");
  }

  if (value === "No images") {
    return t("No images");
  }

  if (
    value === "No balance" ||
    value === "No billing" ||
    value === "Billing unavailable" ||
    value === "No workspace" ||
    value === "No estimate" ||
    value === "Unavailable"
  ) {
    return t(value);
  }

  const monthlyMatch = value.match(/^(.+)\/mo$/);

  if (monthlyMatch) {
    return t("{value}/mo", { value: monthlyMatch[1] ?? value });
  }

  const countMatch = value.match(/^(\d+)\s+(service|services|version|versions)$/);

  if (countMatch) {
    const count = Number.parseInt(countMatch[1] ?? "", 10);
    const unit = countMatch[2];

    if (Number.isFinite(count)) {
      if (unit === "service" || unit === "services") {
        return t(count === 1 ? "{count} service" : "{count} services", { count });
      }

      if (unit === "version" || unit === "versions") {
        return t(count === 1 ? "{count} version" : "{count} versions", { count });
      }
    }
  }

  return value;
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
  const { t } = useI18n();
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
        confirmLabel: t("Delete user"),
        description: t("{email} will be removed from Fugue.", {
          email: user.email,
        }),
        title: t("Delete user?"),
      });

      if (!confirmed) {
        return;
      }
    }

    if (action === "promote") {
      const confirmed = await confirm({
        confirmLabel: t("Make admin"),
        description:
          user.status.toLowerCase() === "blocked"
            ? t("{email} will become an admin and their access will be restored.", {
                email: user.email,
              })
            : t("{email} will gain workspace admin access.", {
                email: user.email,
              }),
        eyebrow: t("Privilege change"),
        title: t("Promote user to admin?"),
        variant: "primary",
      });

      if (!confirmed) {
        return;
      }
    }

    if (action === "demote") {
      const confirmed = await confirm({
        cancelLabel: t("Keep admin"),
        confirmLabel: t("Remove admin"),
        description: t(
          "{email} will lose admin access and stay in the workspace as a regular user.",
          {
            email: user.email,
          },
        ),
        eyebrow: t("Privilege change"),
        title: t("Remove admin access?"),
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
      }, t);

      showToast({
        message:
          action === "block"
            ? t("User blocked.")
            : action === "unblock"
              ? t("User unblocked.")
            : action === "promote"
              ? user.status.toLowerCase() === "blocked"
                ? t("User promoted to admin and restored.")
                : t("User promoted to admin.")
              : action === "demote"
                ? t("Admin access removed.")
              : t("User deleted."),
        variant: "success",
      });
      refreshPage();
    } catch (error) {
      showToast({
        message: readErrorMessage(error, t),
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
        t,
      );

      closeQuotaEditor();
      showToast({
        message: t("Managed limit updated."),
        variant: "success",
      });
      refreshPage();
    } catch (error) {
      const message = readErrorMessage(error, t);
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
      const message = t("Enter a non-negative USD amount with up to two decimal places.");
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
        t,
      );

      closeQuotaEditor();
      showToast({
        message: t("Balance updated."),
        variant: "success",
      });
      refreshPage();
    } catch (error) {
      const message = readErrorMessage(error, t);
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
        description={t("No product users have signed in yet.")}
        title={t("No users yet")}
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
              <th>{t("User")}</th>
              <th>{t("Status")}</th>
              <th>{t("Provider")}</th>
              <th>
                <span className="fg-admin-user-column-head">
                  <span className="fg-admin-user-column-head__label">{t("Balance")}</span>
                  <span className="fg-admin-user-column-head__meta">
                    {t("Prepaid / status")}
                  </span>
                </span>
              </th>
              <th>
                <span className="fg-admin-user-column-head">
                  <span className="fg-admin-user-column-head__label">{t("Managed limit")}</span>
                  <span className="fg-admin-user-column-head__meta">
                    {t("CPU / Memory / Storage / Monthly")}
                  </span>
                </span>
              </th>
              <th>
                <span className="fg-admin-user-column-head">
                  <span className="fg-admin-user-column-head__label">{t("Service usage")}</span>
                  <span className="fg-admin-user-column-head__meta">
                    {t("Services / CPU / Memory / Disk / Images")}
                  </span>
                </span>
              </th>
              <th>{t("Last login")}</th>
              <th>{t("Actions")}</th>
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
                  : t("No stats");
              const billingMemoryLabel =
                user.billing.memoryMebibytes !== null
                  ? formatMemory(user.billing.memoryMebibytes)
                  : t("No stats");
              const billingStorageLabel =
                user.billing.storageGibibytes !== null
                  ? formatStorage(user.billing.storageGibibytes)
                  : t("No stats");
              const billingMonthlyLabel = user.billing.monthlyEstimateLabel
                ? t("{value}/mo", { value: user.billing.monthlyEstimateLabel })
                : user.billing.loadError
                  ? t("Unavailable")
                  : t("No estimate");
              const billingStatusLabel = user.billing.statusLabel
                ? t(user.billing.statusLabel)
                : user.billing.loadError
                  ? t("Unavailable")
                  : t("No billing");
              const balanceValueLabel =
                user.billing.balanceLabel ??
                (user.billing.loadError
                  ? t("Unavailable")
                  : user.billing.tenantId
                    ? t("No balance")
                    : t("No workspace"));
              const balanceMetaLabel = user.billing.statusLabel
                ? t(user.billing.statusLabel)
                : user.billing.loadError
                  ? t("Billing unavailable")
                  : user.billing.tenantId
                    ? t("No billing")
                    : t("No workspace");
              const localizedLimitLabel = readLocalizedUsageValue(user.billing.limitLabel, t);
              const localizedLoadError = user.billing.loadError ? t(user.billing.loadError) : null;
              const localizedUsageServiceCount = readLocalizedUsageValue(
                user.usage.serviceCountLabel,
                t,
              );
              const localizedUsageCpu = readLocalizedUsageValue(user.usage.cpuLabel, t);
              const localizedUsageMemory = readLocalizedUsageValue(user.usage.memoryLabel, t);
              const localizedUsageDisk = readLocalizedUsageValue(user.usage.diskLabel, t);
              const localizedUsageImage = readLocalizedUsageValue(user.usage.imageLabel, t);
              const managedLimitSummaryLabel = [
                t("CPU {value}", { value: billingCpuLabel }),
                t("Memory {value}", { value: billingMemoryLabel }),
                t("Storage {value}", { value: billingStorageLabel }),
                t("Monthly {value}", { value: billingMonthlyLabel }),
              ].join(" / ");
              const balanceTitle = [
                t("Balance {value}", { value: balanceValueLabel }),
                balanceMetaLabel,
                user.billing.statusReason,
                localizedLoadError,
              ]
                .filter(Boolean)
                .join(" / ");
              const managedLimitTitle = [
                managedLimitSummaryLabel,
                t("Limit {value}", { value: localizedLimitLabel }),
                user.billing.statusLabel
                  ? t("Status {value}", { value: billingStatusLabel })
                  : null,
                user.billing.statusReason,
                localizedLoadError,
              ]
                .filter(Boolean)
                .join(" / ");
              const balanceStatusContent = user.billing.statusLabel ? (
                <StatusBadge className="fg-admin-user-signal-badge" tone={user.billing.statusTone}>
                  {t(user.billing.statusLabel)}
                </StatusBadge>
              ) : (
                <span className="fg-admin-user-signal__fallback">
                  {balanceMetaLabel}
                </span>
              );
              const usageSummaryLabel = [
                t("Services {value}", { value: localizedUsageServiceCount }),
                t("CPU {value}", { value: localizedUsageCpu }),
                t("Memory {value}", { value: localizedUsageMemory }),
                t("Disk {value}", { value: localizedUsageDisk }),
                t("Images {value}", { value: localizedUsageImage }),
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
                      <StatusBadge tone={user.statusTone}>{t(user.status)}</StatusBadge>
                      {user.isAdmin ? <StatusBadge tone="info">{t("Admin")}</StatusBadge> : null}
                    </div>
                  </td>
                  <td>
                    <div className="fg-console-table__pair">
                      <strong>{t(user.provider)}</strong>
                      <span>/ {user.verified ? t("Verified") : t("Unverified")}</span>
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
                          <dt>{t("Memory")}</dt>
                          <dd>{billingMemoryLabel}</dd>
                        </div>
                        <div className="fg-admin-user-signal">
                          <dt>{t("Storage")}</dt>
                          <dd>{billingStorageLabel}</dd>
                        </div>
                        <div className="fg-admin-user-signal">
                          <dt>{t("Monthly")}</dt>
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
                          <dt>{t("Services")}</dt>
                          <dd>{localizedUsageServiceCount}</dd>
                        </div>
                        <div className="fg-admin-user-signal">
                          <dt>CPU</dt>
                          <dd>{localizedUsageCpu}</dd>
                        </div>
                        <div className="fg-admin-user-signal">
                          <dt>{t("Memory")}</dt>
                          <dd>{localizedUsageMemory}</dd>
                        </div>
                        <div className="fg-admin-user-signal">
                          <dt>{t("Disk")}</dt>
                          <dd>{localizedUsageDisk}</dd>
                        </div>
                        <div className="fg-admin-user-signal">
                          <dt>{t("Images")}</dt>
                          <dd>{localizedUsageImage}</dd>
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
                          busyLabel={t("Saving…")}
                          label={t("Edit billing")}
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
                          busyLabel={t("Promoting…")}
                          label={t("Make admin")}
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
                          busyLabel={t("Updating…")}
                          label={t("Remove admin")}
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
                          busyLabel={t("Blocking…")}
                          label={t("Block")}
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
                          busyLabel={t("Unblocking…")}
                          label={t("Unblock")}
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
                          busyLabel={t("Deleting…")}
                          danger
                          label={t("Delete")}
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
                    <p className="fg-label fg-panel__eyebrow">{t("User billing")}</p>
                    <PanelTitle className="fg-console-dialog__title" id={quotaDialogTitleId}>
                      {t("Edit billing")}
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
                          {t(editingQuotaUser.billing.statusLabel)}
                        </StatusBadge>
                      ) : null}
                      {editingQuotaUser.billing.balanceLabel ? (
                        <StatusBadge tone="neutral">
                          {t("Balance {value}", {
                            value: editingQuotaUser.billing.balanceLabel,
                          })}
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
                      {t(
                        "The saved limit is above the temporary control cap of 2 cpu / 4 GiB / 30 GiB storage. Save a new limit here to bring the user back inside the current range.",
                      )}
                    </InlineAlert>
                  ) : null}

                  <div className="fg-admin-user-billing-dialog__sections">
                    <section className="fg-admin-user-billing-dialog__section">
                      <div className="fg-admin-user-billing-dialog__section-head">
                        <strong>{t("Managed limit")}</strong>
                        <span>{readLocalizedUsageValue(editingQuotaUser.billing.limitLabel, t)}</span>
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
                            hint={t(
                              "Adjust from 0 to {max} cpu in {step} cpu steps.",
                              {
                                max: CPU_SLIDER_MAX_CORES,
                                step: CPU_STEP_CORES,
                              },
                            )}
                            id={`quota-cpu-${editingQuotaUser.email}`}
                            label={t("CPU limit")}
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
                            hint={t(
                              "Adjust from 0 to {max} GiB in {step} GiB steps.",
                              {
                                max: MEMORY_SLIDER_MAX_GIB,
                                step: MEMORY_STEP_GIB,
                              },
                            )}
                            id={`quota-memory-${editingQuotaUser.email}`}
                            label={t("Memory limit")}
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
                            label={t("Storage limit")}
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
                                ? t("{value} / month", {
                                    value: formatCurrencyFromMicroCents(
                                      previewMonthly,
                                      previewPriceBook.currency,
                                    ),
                                  })
                                : t("Monthly preview unavailable")}
                            </strong>
                            <p>
                              {quotaCpu === 0 || quotaMemory === 0
                                ? t("Set CPU or memory to 0 to pause managed billing.")
                                : previewBilledSpec.storageGibibytes !== quotaStorage
                                  ? t(
                                      "{limit} limit. Billed as {billed} until live storage shrinks.",
                                      {
                                        billed: formatResourceSpec(previewBilledSpec),
                                        limit: formatResourceSpec(previewSpec),
                                      },
                                    )
                                  : formatResourceSpec(previewSpec)}
                            </p>
                          </div>

                          <div className="fg-admin-user-quota-form__actions">
                            <Button
                              disabled={quotaBlocked || !quotaDirty}
                              loading={quotaBusy}
                              loadingLabel={t("Saving…")}
                              type="submit"
                              variant="primary"
                            >
                              {t("Save limit")}
                            </Button>
                          </div>
                        </div>
                      </form>
                    </section>

                    <section className="fg-admin-user-billing-dialog__section">
                      <div className="fg-admin-user-billing-dialog__section-head">
                        <strong>{t("Balance")}</strong>
                        <span>{editingQuotaUser.billing.balanceLabel ?? t("No balance")}</span>
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
                            label={t("Set balance")}
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
                              loadingLabel={t("Saving…")}
                              type="submit"
                              variant="primary"
                            >
                              {t("Save balance")}
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
                    {t("Close")}
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
