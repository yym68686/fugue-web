"use client";

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { StatusBadge } from "@/components/console/status-badge";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button, InlineButton } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { HintInline, HintTooltip } from "@/components/ui/hint-tooltip";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import {
  SegmentedControl,
  type SegmentedControlOption,
} from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import type { Locale, TranslationValues } from "@/lib/i18n/core";
import {
  formatCurrencyFromMicroCents,
  isRuntimePublicOfferEffectivelyFree,
  MEBIBYTES_PER_GIB,
  MICRO_CENTS_PER_DOLLAR,
  MILLICORES_PER_CORE,
  readRuntimePublicOfferDescription,
  readRuntimePublicOfferSummary,
} from "@/lib/runtimes/public-offer";
import type {
  RuntimeOwnership,
  RuntimePublicOfferView,
  RuntimeSharingView,
} from "@/lib/runtimes/types";

type RuntimeSharingPayload = {
  sharing: RuntimeSharingView;
};

type RuntimeAccessMode = "private" | "public";
type RuntimePoolMode = "dedicated" | "internal-shared";
type PublicOfferFieldKey = "cpu" | "memory" | "price" | "storage";
type PublicOfferFieldErrors = Partial<Record<PublicOfferFieldKey, string>>;
type PublicOfferDraft = {
  free: boolean;
  freeCpu: boolean;
  freeMemory: boolean;
  freeStorage: boolean;
  referenceCpuCores: string;
  referenceMemoryGib: string;
  referenceMonthlyPriceUsd: string;
  referenceStorageGib: string;
};

type Translator = (key: string, values?: TranslationValues) => string;

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function readErrorMessage(error: unknown, t: Translator = (key) => key) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return t("Request failed.");
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

async function requestJson<T>(
  input: RequestInfo,
  init?: RequestInit,
  t: Translator = (key) => key,
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

function formatRecentTime(
  value: string | null | undefined,
  formatter: (
    value?: string | number | Date | null,
    options?: {
      justNowText?: string;
      notYetText?: string;
    },
  ) => string,
  t: Translator = (key) => key,
) {
  if (!value) {
    return formatter(null, { notYetText: t("Just now") });
  }
  return formatter(value, {
    justNowText: t("Just now"),
    notYetText: t("Just now"),
  });
}

function normalizeAccessMode(value?: string | null): RuntimeAccessMode {
  return value === "public" || value === "platform-shared"
    ? "public"
    : "private";
}

function normalizePoolMode(value?: string | null): RuntimePoolMode {
  return value === "internal-shared" ? "internal-shared" : "dedicated";
}

function formatDraftNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatPreviewNumber(
  locale: Locale,
  value: number,
  maximumFractionDigits = 2,
) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatUsdDraft(value: number) {
  if (value <= 0) {
    return "";
  }

  return formatDraftNumber(value / MICRO_CENTS_PER_DOLLAR, 2);
}

function formatCpuDraft(value: number) {
  if (value <= 0) {
    return "";
  }

  return formatDraftNumber(value / MILLICORES_PER_CORE, 3);
}

function formatMemoryDraft(value: number) {
  if (value <= 0) {
    return "";
  }

  return formatDraftNumber(value / MEBIBYTES_PER_GIB, 2);
}

function formatStorageDraft(value: number) {
  if (value <= 0) {
    return "";
  }

  return `${Math.round(value)}`;
}

function buildPublicOfferDraft(
  offer?: RuntimePublicOfferView | null,
): PublicOfferDraft {
  return {
    free: offer?.free ?? false,
    freeCpu: offer?.freeCpu ?? false,
    freeMemory: offer?.freeMemory ?? false,
    freeStorage: offer?.freeStorage ?? false,
    referenceCpuCores: formatCpuDraft(
      offer?.referenceBundle.cpuMillicores ?? 0,
    ),
    referenceMemoryGib: formatMemoryDraft(
      offer?.referenceBundle.memoryMebibytes ?? 0,
    ),
    referenceMonthlyPriceUsd: formatUsdDraft(
      offer?.referenceMonthlyPriceMicroCents ?? 0,
    ),
    referenceStorageGib: formatStorageDraft(
      offer?.referenceBundle.storageGibibytes ?? 0,
    ),
  };
}

function arePublicOfferDraftsEqual(
  left: PublicOfferDraft,
  right: PublicOfferDraft,
) {
  return (
    left.free === right.free &&
    left.freeCpu === right.freeCpu &&
    left.freeMemory === right.freeMemory &&
    left.freeStorage === right.freeStorage &&
    left.referenceCpuCores === right.referenceCpuCores &&
    left.referenceMemoryGib === right.referenceMemoryGib &&
    left.referenceMonthlyPriceUsd === right.referenceMonthlyPriceUsd &&
    left.referenceStorageGib === right.referenceStorageGib
  );
}

function parseNonNegativeDecimal(value: string, maximumDecimals = 3) {
  const normalized = value.trim();

  if (!normalized) {
    return {
      valid: true,
      value: null,
    } as const;
  }

  const normalizedMaximumDecimals = Math.max(0, Math.trunc(maximumDecimals));
  const pattern =
    normalizedMaximumDecimals === 0
      ? /^\d+$/
      : new RegExp(`^\\d+(?:\\.\\d{1,${normalizedMaximumDecimals}})?$`);

  if (!pattern.test(normalized)) {
    return {
      valid: false,
      value: null,
    } as const;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) && parsed >= 0
    ? {
        valid: true,
        value: parsed,
      }
    : {
        valid: false,
        value: null,
      };
}

function parseUsdValue(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return {
      valid: true,
      value: null,
    } as const;
  }

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return {
      valid: false,
      value: null,
    } as const;
  }

  const [whole = "0", fraction = ""] = normalized.split(".");
  const dollars = Number(whole);
  const cents = Number(fraction.padEnd(2, "0"));

  if (!Number.isFinite(dollars) || !Number.isFinite(cents)) {
    return {
      valid: false,
      value: null,
    } as const;
  }

  return {
    valid: true,
    value:
      dollars * MICRO_CENTS_PER_DOLLAR + cents * (MICRO_CENTS_PER_DOLLAR / 100),
  } as const;
}

function buildPublicOfferFieldErrors(
  draft: PublicOfferDraft,
  t: Translator = (key) => key,
) {
  const cpu = parseNonNegativeDecimal(draft.referenceCpuCores, 3);
  const memory = parseNonNegativeDecimal(draft.referenceMemoryGib, 2);
  const storage = parseNonNegativeDecimal(draft.referenceStorageGib, 0);
  const price = parseUsdValue(draft.referenceMonthlyPriceUsd);
  const errors: PublicOfferFieldErrors = {};

  if (!cpu.valid) {
    errors.cpu = t("Enter a non-negative CPU value with up to three decimals.");
  }

  if (!memory.valid) {
    errors.memory = t(
      "Enter a non-negative memory value with up to two decimals.",
    );
  }

  if (!storage.valid) {
    errors.storage = t("Enter a whole, non-negative disk size in GiB.");
  }

  if (!price.valid) {
    errors.price = t(
      "Enter a non-negative USD amount with up to two decimal places.",
    );
  }

  if (!draft.free && (!price.value || price.value <= 0)) {
    errors.price = t(
      "Enter a monthly price greater than 0, or mark the server free.",
    );
  }

  if (!draft.free && !draft.freeCpu && (!cpu.value || cpu.value <= 0)) {
    errors.cpu = t("CPU must be greater than 0 unless CPU is free.");
  }

  if (
    !draft.free &&
    !draft.freeMemory &&
    (!memory.value || memory.value <= 0)
  ) {
    errors.memory = t("Memory must be greater than 0 unless memory is free.");
  }

  if (
    !draft.free &&
    !draft.freeStorage &&
    (!storage.value || storage.value <= 0)
  ) {
    errors.storage = t("Disk must be greater than 0 unless disk is free.");
  }

  return errors;
}

function hasPublicOfferFieldErrors(errors: PublicOfferFieldErrors) {
  return Object.values(errors).some((value) => Boolean(value));
}

function readDraftPublicOfferSummary(
  draft: PublicOfferDraft,
  locale: Locale = "en",
  t: Translator = (key) => key,
) {
  if (draft.free) {
    return t("Free for all deployers.");
  }

  const cpu = parseNonNegativeDecimal(draft.referenceCpuCores, 3);
  const memory = parseNonNegativeDecimal(draft.referenceMemoryGib, 2);
  const storage = parseNonNegativeDecimal(draft.referenceStorageGib, 0);
  const price = parseUsdValue(draft.referenceMonthlyPriceUsd);
  const bundle = [
    cpu.value && cpu.value > 0
      ? t("{value} CPU", {
          value: formatPreviewNumber(locale, cpu.value, 3),
        })
      : null,
    memory.value && memory.value > 0
      ? t("{value} GiB", {
          value: formatPreviewNumber(locale, memory.value, 2),
        })
      : null,
    storage.value && storage.value > 0
      ? t("{value} GiB", {
          value: formatPreviewNumber(locale, storage.value, 0),
        })
      : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" / ");
  const freeParts = [
    draft.freeCpu ? t("CPU free") : null,
    draft.freeMemory ? t("Memory free") : null,
    draft.freeStorage ? t("Disk free") : null,
  ].filter((part): part is string => Boolean(part));
  const priceLabel =
    price.valid && price.value && price.value > 0
      ? t("{price}/mo reference", {
          price: formatCurrencyFromMicroCents(price.value, "USD", locale),
        })
      : t("Reference price not set");

  return [priceLabel, bundle, ...freeParts]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

function buildPublicOfferPayload(draft: PublicOfferDraft) {
  const cpu = parseNonNegativeDecimal(draft.referenceCpuCores, 3);
  const memory = parseNonNegativeDecimal(draft.referenceMemoryGib, 2);
  const storage = parseNonNegativeDecimal(draft.referenceStorageGib, 0);
  const price = parseUsdValue(draft.referenceMonthlyPriceUsd);

  return {
    free: draft.free,
    free_cpu: draft.freeCpu,
    free_memory: draft.freeMemory,
    free_storage: draft.freeStorage,
    reference_bundle: {
      cpu_millicores: Math.round((cpu.value ?? 0) * MILLICORES_PER_CORE),
      memory_mebibytes: Math.round((memory.value ?? 0) * MEBIBYTES_PER_GIB),
      storage_gibibytes: Math.round(storage.value ?? 0),
    },
    reference_monthly_price_microcents: price.value ?? 0,
  };
}

function readPoolModeLabel(
  value: string | null | undefined,
  t: Translator = (key) => key,
) {
  return normalizePoolMode(value) === "internal-shared"
    ? t("Enabled")
    : t("Dedicated only");
}

function readAccessSummaryLabel({
  accessMode,
  grantCount,
  ownership,
  poolMode,
  t,
}: {
  accessMode: string | null;
  grantCount: number;
  ownership: RuntimeOwnership;
  poolMode: RuntimePoolMode;
  t: Translator;
}) {
  if (ownership === "internal-cluster") {
    return t("Cluster");
  }

  if (accessMode === "platform-shared") {
    return t("Platform shared");
  }

  if (accessMode === "public") {
    return poolMode === "internal-shared" ? t("Public + cluster") : t("Public");
  }

  if (ownership === "shared") {
    return t("Granted");
  }

  if (grantCount > 0 && poolMode === "internal-shared") {
    return t(
      grantCount === 1
        ? "{count} workspace + cluster"
        : "{count} workspaces + cluster",
      {
        count: grantCount,
      },
    );
  }

  if (grantCount > 0) {
    return t(grantCount === 1 ? "{count} workspace" : "{count} workspaces", {
      count: grantCount,
    });
  }

  if (poolMode === "internal-shared") {
    return t("Cluster enabled");
  }

  return t("Private");
}

function readAccessMeta({
  accessMode,
  ownerEmail,
  ownerLabel,
  ownership,
  t,
}: {
  accessMode: string | null;
  ownerEmail: string | null;
  ownerLabel: string;
  ownership: RuntimeOwnership;
  t: Translator;
}) {
  if (accessMode === "public") {
    if (ownership === "shared") {
      return ownerEmail
        ? t("Public server by {label}", { label: ownerEmail })
        : t("Public server by {label}", { label: ownerLabel });
    }

    return null;
  }

  if (ownership === "shared") {
    return ownerEmail
      ? t("Shared by {label}", { label: ownerEmail })
      : t("Shared by {label}", { label: ownerLabel });
  }

  return null;
}

function readClusterMeta({
  canManagePool,
  ownership,
  poolMode,
  t,
}: {
  canManagePool: boolean;
  ownership: RuntimeOwnership;
  poolMode: RuntimePoolMode;
  t: Translator;
}) {
  if (poolMode === "internal-shared") {
    return t("System access · internal cluster can deploy here");
  }

  if (ownership !== "owned") {
    return t("System access is not enabled");
  }

  if (canManagePool) {
    return t("Allow the internal cluster to deploy here");
  }

  return t("Only admins can allow the internal cluster to deploy here");
}

function readClusterTone(value: RuntimePoolMode) {
  return value === "internal-shared" ? "info" : "neutral";
}

function AccessRow({
  action,
  badge,
  meta,
  title,
}: {
  action?: ReactNode;
  badge?: {
    label: string;
    tone?: "danger" | "info" | "neutral" | "positive" | "warning";
  };
  meta?: string;
  title: string;
}) {
  return (
    <article className="fg-runtime-share-row">
      <div className="fg-runtime-share-row__copy">
        <strong>{title}</strong>
        {meta ? <span>{meta}</span> : null}
      </div>

      <div className="fg-runtime-share-row__actions">
        {badge ? (
          <StatusBadge tone={badge.tone ?? "neutral"}>
            {badge.label}
          </StatusBadge>
        ) : null}
        {action}
      </div>
    </article>
  );
}

function AccessSection({
  action,
  children,
  eyebrow,
  hint,
  note,
  title,
}: {
  action?: ReactNode;
  children?: ReactNode;
  eyebrow: string;
  hint?: string;
  note?: string;
  title: string;
}) {
  const helperCopy =
    note && hint ? (
      <span className="fg-hint-tooltip__stack">
        <span>{note}</span>
        <span>{hint}</span>
      </span>
    ) : (note ?? hint ?? null);

  return (
    <section className="fg-runtime-access-section">
      <div className="fg-runtime-access-section__head">
        <div className="fg-runtime-access-section__copy">
          <p className="fg-label fg-panel__eyebrow">{eyebrow}</p>
          <HintInline
            ariaLabel={title}
            className="fg-runtime-access-section__title-row"
            hint={helperCopy}
          >
            <h3 className="fg-runtime-access-section__title fg-ui-heading">
              {title}
            </h3>
          </HintInline>
        </div>

        {action ? (
          <div className="fg-runtime-access-section__action">{action}</div>
        ) : null}
      </div>

      {children}
    </section>
  );
}

type RuntimePublicPricingDialogControlProps = {
  autoOpenSignal: number;
  busyAction: string | null;
  currentPublicOffer: RuntimePublicOfferView | null;
  onSharingUpdated: (sharing: RuntimeSharingView) => void;
  runtimeId: string | null;
  showPublicPricingEditor: boolean;
};

function RuntimePublicPricingDialogControl({
  autoOpenSignal,
  busyAction,
  currentPublicOffer,
  onSharingUpdated,
  runtimeId,
  showPublicPricingEditor,
}: RuntimePublicPricingDialogControlProps) {
  const { formatRelativeTime, locale, t } = useI18n();
  const confirm = useConfirmDialog();
  const { showToast } = useToast();
  const dialogIdBase = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const dialogBackdropPressStartedRef = useRef(false);
  const dialogReturnFocusRef = useRef<HTMLElement | null>(null);
  const lastAutoOpenSignalRef = useRef(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [publicOfferDraft, setPublicOfferDraft] = useState<PublicOfferDraft>(() =>
    buildPublicOfferDraft(currentPublicOffer),
  );
  const [publicOfferErrors, setPublicOfferErrors] =
    useState<PublicOfferFieldErrors>({});
  const [publicOfferError, setPublicOfferError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dialogPortalTarget =
    typeof document === "undefined" ? null : document.body;
  const publicOfferBaseId = runtimeId
    ? `${runtimeId}-public-offer`
    : "runtime-public-offer";
  const pricingDialogId = `runtime-public-pricing-dialog-${dialogIdBase}`;
  const pricingDialogTitleId = `${pricingDialogId}-title`;
  const pricingDialogDescriptionId = `${pricingDialogId}-description`;
  const pricingDialogFormId = `${pricingDialogId}-form`;
  const baselinePublicOfferDraft = buildPublicOfferDraft(currentPublicOffer);
  const publicOfferPreview = readDraftPublicOfferSummary(
    publicOfferDraft,
    locale,
    t,
  );
  const publicPricingSaveNote = currentPublicOffer?.updatedAt
    ? t("Last saved {time}.", {
        time: formatRecentTime(currentPublicOffer.updatedAt, formatRelativeTime, t),
      })
    : t("No public pricing saved yet.");
  const publicPricingHasUnsavedChanges = !arePublicOfferDraftsEqual(
    publicOfferDraft,
    baselinePublicOfferDraft,
  );

  const syncDraftFromCurrentOffer = useEffectEvent(() => {
    const nextDraft = buildPublicOfferDraft(currentPublicOffer);

    setPublicOfferDraft((current) =>
      arePublicOfferDraftsEqual(current, nextDraft) ? current : nextDraft,
    );
    setPublicOfferErrors((current) =>
      hasPublicOfferFieldErrors(current) ? {} : current,
    );
    setPublicOfferError((current) => (current === null ? current : null));
  });

  const closeDialog = useEffectEvent(
    (restoreFocus: boolean, resetDraft = true) => {
      setDialogOpen(false);
      dialogBackdropPressStartedRef.current = false;

      if (resetDraft) {
        syncDraftFromCurrentOffer();
      }

      const returnFocusTarget = dialogReturnFocusRef.current;
      dialogReturnFocusRef.current = null;

      if (!restoreFocus || !returnFocusTarget) {
        return;
      }

      window.requestAnimationFrame(() => {
        if (returnFocusTarget.isConnected) {
          returnFocusTarget.focus();
        }
      });
    },
  );

  const openDialog = useEffectEvent((target: HTMLElement | null) => {
    if (!showPublicPricingEditor || busyAction !== null || saving) {
      return;
    }

    dialogReturnFocusRef.current = target;
    syncDraftFromCurrentOffer();
    setDialogOpen(true);
  });

  const requestDialogDismiss = useEffectEvent(async (restoreFocus: boolean) => {
    if (saving) {
      return;
    }

    if (publicPricingHasUnsavedChanges) {
      const confirmed = await confirm({
        confirmLabel: t("Discard changes"),
        description: t(
          "Your public pricing draft will be lost if you close this dialog now.",
        ),
        title: t("Discard pricing changes?"),
        variant: "danger",
      });

      if (!confirmed) {
        return;
      }
    }

    closeDialog(restoreFocus);
  });

  const handleDialogKeyDown = useEffectEvent(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!dialogOpen) {
        return;
      }

      if (event.key === "Escape") {
        if (saving) {
          return;
        }

        event.preventDefault();
        void requestDialogDismiss(true);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = readFocusableElements(dialogRef.current);

      if (!focusableElements.length) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const activeInsideDialog = activeElement
        ? dialogRef.current?.contains(activeElement)
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
    },
  );

  const handleDialogBackdropPointerDown = useEffectEvent(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (saving) {
        dialogBackdropPressStartedRef.current = false;
        return;
      }

      dialogBackdropPressStartedRef.current = event.target === event.currentTarget;
    },
  );

  const handleDialogBackdropClick = useEffectEvent(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const shouldClose =
        !saving &&
        dialogBackdropPressStartedRef.current &&
        event.target === event.currentTarget;

      dialogBackdropPressStartedRef.current = false;

      if (!shouldClose) {
        return;
      }

      void requestDialogDismiss(true);
    },
  );

  const handlePublicOfferSave = useEffectEvent(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!runtimeId || busyAction !== null || saving) {
        return;
      }

      const errors = buildPublicOfferFieldErrors(publicOfferDraft, t);
      setPublicOfferErrors(errors);

      if (hasPublicOfferFieldErrors(errors)) {
        return;
      }

      setSaving(true);
      setPublicOfferError(null);

      try {
        const data = await requestJson<RuntimeSharingPayload>(
          `/api/fugue/runtimes/${encodeURIComponent(runtimeId)}/public-offer`,
          {
            body: JSON.stringify(buildPublicOfferPayload(publicOfferDraft)),
            headers: {
              "Content-Type": "application/json",
            },
            method: "POST",
          },
          t,
        );

        onSharingUpdated(data.sharing);
        setPublicOfferDraft(buildPublicOfferDraft(data.sharing.publicOffer));
        setPublicOfferErrors({});
        setPublicOfferError(null);
        closeDialog(false, false);
        showToast({
          message: t("Public pricing saved."),
          variant: "success",
        });
      } catch (error) {
        setPublicOfferError(readErrorMessage(error, t));
      } finally {
        setSaving(false);
      }
    },
  );

  useEffect(() => {
    if (dialogOpen) {
      return;
    }

    syncDraftFromCurrentOffer();
  }, [currentPublicOffer, dialogOpen, runtimeId, syncDraftFromCurrentOffer]);

  useEffect(() => {
    if (!dialogOpen) {
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
      const focusableElements = readFocusableElements(dialogRef.current);
      focusableElements[0]?.focus({ preventScroll: true });
    });

    return () => {
      dialogBackdropPressStartedRef.current = false;
      window.cancelAnimationFrame(frame);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [dialogOpen]);

  useEffect(() => {
    if (showPublicPricingEditor) {
      return;
    }

    setDialogOpen(false);
    dialogReturnFocusRef.current = null;
    dialogBackdropPressStartedRef.current = false;
    syncDraftFromCurrentOffer();
  }, [runtimeId, showPublicPricingEditor, syncDraftFromCurrentOffer]);

  useEffect(() => {
    if (
      autoOpenSignal === 0 ||
      autoOpenSignal === lastAutoOpenSignalRef.current ||
      !showPublicPricingEditor ||
      busyAction !== null ||
      saving
    ) {
      return;
    }

    lastAutoOpenSignalRef.current = autoOpenSignal;
    const activeTarget =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openDialog(activeTarget);
  }, [
    autoOpenSignal,
    busyAction,
    openDialog,
    saving,
    showPublicPricingEditor,
  ]);

  if (!showPublicPricingEditor) {
    return null;
  }

  return (
    <>
      <Button
        aria-controls={dialogOpen ? pricingDialogId : undefined}
        aria-expanded={dialogOpen}
        aria-haspopup="dialog"
        disabled={busyAction !== null || saving}
        onClick={(event) => {
          openDialog(event.currentTarget);
        }}
        size="compact"
        type="button"
        variant={currentPublicOffer ? "secondary" : "primary"}
      >
        {currentPublicOffer ? t("Edit pricing") : t("Set pricing")}
      </Button>

      {dialogOpen && dialogPortalTarget
        ? createPortal(
            <div
              className="fg-console-dialog-backdrop"
              onClick={handleDialogBackdropClick}
              onPointerDown={handleDialogBackdropPointerDown}
            >
              <div
                aria-busy={saving || undefined}
                aria-describedby={pricingDialogDescriptionId}
                aria-labelledby={pricingDialogTitleId}
                aria-modal="true"
                className="fg-console-dialog-shell fg-runtime-pricing-dialog-shell"
                id={pricingDialogId}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={handleDialogKeyDown}
                ref={dialogRef}
                role="dialog"
              >
                <Panel className="fg-console-dialog-panel">
                  <PanelSection>
                    <div className="fg-console-dialog__head fg-runtime-pricing-dialog__head">
                      <div className="fg-console-dialog__copy fg-runtime-pricing-dialog__copy">
                        <p className="fg-label fg-panel__eyebrow">
                          {t("Public pricing")}
                        </p>
                        <PanelTitle
                          className="fg-console-dialog__title"
                          id={pricingDialogTitleId}
                        >
                          {t("Set one reference bundle")}
                        </PanelTitle>
                        <PanelCopy id={pricingDialogDescriptionId}>
                          {t(
                            "Use one representative bundle and monthly price. Fugue derives unit CPU, memory, and disk pricing from it.",
                          )}
                        </PanelCopy>
                      </div>

                      <div className="fg-console-dialog__meta fg-runtime-pricing-dialog__meta">
                        <StatusBadge
                          className="fg-status-badge--truncate"
                          tone={
                            publicOfferDraft.free ||
                            isRuntimePublicOfferEffectivelyFree(currentPublicOffer)
                              ? "positive"
                              : "info"
                          }
                        >
                          {publicOfferPreview}
                        </StatusBadge>
                        <span className="fg-console-dialog__meta-note">
                          {publicPricingSaveNote}
                        </span>
                      </div>
                    </div>
                  </PanelSection>

                  <PanelSection className="fg-console-dialog__body">
                    <form
                      className="fg-runtime-public-offer"
                      id={pricingDialogFormId}
                      onSubmit={handlePublicOfferSave}
                    >
                      <label className="fg-project-toggle fg-runtime-public-offer__primary-toggle">
                        <input
                          checked={publicOfferDraft.free}
                          disabled={busyAction !== null || saving}
                          onChange={(event) => {
                            setPublicOfferDraft((current) => ({
                              ...current,
                              free: event.target.checked,
                            }));
                            setPublicOfferErrors({});
                            setPublicOfferError(null);
                          }}
                          type="checkbox"
                        />
                        <HintInline
                          ariaLabel={t("Free for everyone")}
                          as="span"
                          className="fg-runtime-public-offer__primary-toggle-copy"
                          hint={
                            publicOfferDraft.free
                              ? t(
                                  "Anyone can deploy here without paying you while this stays on.",
                                )
                              : t(
                                  "Skip pricing and let anyone deploy here at no cost.",
                                )
                          }
                        >
                          <strong>{t("Free for everyone")}</strong>
                        </HintInline>
                      </label>

                      {publicOfferDraft.free ? null : (
                        <>
                          <div className="fg-runtime-public-offer__grid">
                            <FormField
                              error={publicOfferErrors.cpu}
                              hint={t("Reference CPU cores")}
                              htmlFor={`${publicOfferBaseId}-cpu`}
                              label={t("CPU")}
                              optionalLabel="cores"
                            >
                              <input
                                className="fg-input"
                                disabled={busyAction !== null || saving}
                                id={`${publicOfferBaseId}-cpu`}
                                inputMode="decimal"
                                onChange={(event) => {
                                  setPublicOfferDraft((current) => ({
                                    ...current,
                                    referenceCpuCores: event.target.value,
                                  }));
                                  setPublicOfferErrors((current) => ({
                                    ...current,
                                    cpu: undefined,
                                  }));
                                  setPublicOfferError(null);
                                }}
                                placeholder="2"
                                type="text"
                                value={publicOfferDraft.referenceCpuCores}
                              />
                            </FormField>

                            <FormField
                              error={publicOfferErrors.memory}
                              hint={t("Reference memory in GiB")}
                              htmlFor={`${publicOfferBaseId}-memory`}
                              label={t("Memory")}
                              optionalLabel="GiB"
                            >
                              <input
                                className="fg-input"
                                disabled={busyAction !== null || saving}
                                id={`${publicOfferBaseId}-memory`}
                                inputMode="decimal"
                                onChange={(event) => {
                                  setPublicOfferDraft((current) => ({
                                    ...current,
                                    referenceMemoryGib: event.target.value,
                                  }));
                                  setPublicOfferErrors((current) => ({
                                    ...current,
                                    memory: undefined,
                                  }));
                                  setPublicOfferError(null);
                                }}
                                placeholder="4"
                                type="text"
                                value={publicOfferDraft.referenceMemoryGib}
                              />
                            </FormField>

                            <FormField
                              error={publicOfferErrors.storage}
                              hint={t("Reference persistent disk in GiB")}
                              htmlFor={`${publicOfferBaseId}-storage`}
                              label={t("Disk")}
                              optionalLabel="GiB"
                            >
                              <input
                                className="fg-input"
                                disabled={busyAction !== null || saving}
                                id={`${publicOfferBaseId}-storage`}
                                inputMode="numeric"
                                onChange={(event) => {
                                  setPublicOfferDraft((current) => ({
                                    ...current,
                                    referenceStorageGib: event.target.value,
                                  }));
                                  setPublicOfferErrors((current) => ({
                                    ...current,
                                    storage: undefined,
                                  }));
                                  setPublicOfferError(null);
                                }}
                                placeholder="30"
                                type="text"
                                value={publicOfferDraft.referenceStorageGib}
                              />
                            </FormField>

                            <FormField
                              error={publicOfferErrors.price}
                              hint={t("Reference monthly price for that bundle")}
                              htmlFor={`${publicOfferBaseId}-price`}
                              label={t("Monthly price")}
                              optionalLabel="USD"
                            >
                              <input
                                className="fg-input"
                                disabled={busyAction !== null || saving}
                                id={`${publicOfferBaseId}-price`}
                                inputMode="decimal"
                                onChange={(event) => {
                                  setPublicOfferDraft((current) => ({
                                    ...current,
                                    referenceMonthlyPriceUsd: event.target.value,
                                  }));
                                  setPublicOfferErrors((current) => ({
                                    ...current,
                                    price: undefined,
                                  }));
                                  setPublicOfferError(null);
                                }}
                                placeholder="2.00"
                                type="text"
                                value={publicOfferDraft.referenceMonthlyPriceUsd}
                              />
                            </FormField>
                          </div>

                          <div className="fg-runtime-public-offer__subsection">
                            <div className="fg-runtime-public-offer__subhead">
                              <HintInline
                                ariaLabel={t("Optional free resources")}
                                as="span"
                                hint={t(
                                  "Keep one resource free while charging for the rest.",
                                )}
                              >
                                <strong>{t("Optional free resources")}</strong>
                              </HintInline>
                            </div>

                            <div className="fg-runtime-public-offer__toggles">
                              <label className="fg-project-toggle fg-runtime-public-offer__toggle">
                                <input
                                  checked={publicOfferDraft.freeCpu}
                                  disabled={busyAction !== null || saving}
                                  onChange={(event) => {
                                    setPublicOfferDraft((current) => ({
                                      ...current,
                                      freeCpu: event.target.checked,
                                    }));
                                    setPublicOfferErrors((current) => ({
                                      ...current,
                                      cpu: undefined,
                                    }));
                                    setPublicOfferError(null);
                                  }}
                                  type="checkbox"
                                />
                                <span>{t("CPU free")}</span>
                              </label>

                              <label className="fg-project-toggle fg-runtime-public-offer__toggle">
                                <input
                                  checked={publicOfferDraft.freeMemory}
                                  disabled={busyAction !== null || saving}
                                  onChange={(event) => {
                                    setPublicOfferDraft((current) => ({
                                      ...current,
                                      freeMemory: event.target.checked,
                                    }));
                                    setPublicOfferErrors((current) => ({
                                      ...current,
                                      memory: undefined,
                                    }));
                                    setPublicOfferError(null);
                                  }}
                                  type="checkbox"
                                />
                                <span>{t("Memory free")}</span>
                              </label>

                              <label className="fg-project-toggle fg-runtime-public-offer__toggle">
                                <input
                                  checked={publicOfferDraft.freeStorage}
                                  disabled={busyAction !== null || saving}
                                  onChange={(event) => {
                                    setPublicOfferDraft((current) => ({
                                      ...current,
                                      freeStorage: event.target.checked,
                                    }));
                                    setPublicOfferErrors((current) => ({
                                      ...current,
                                      storage: undefined,
                                    }));
                                    setPublicOfferError(null);
                                  }}
                                  type="checkbox"
                                />
                                <span>{t("Disk free")}</span>
                              </label>
                            </div>
                          </div>
                        </>
                      )}

                      {publicOfferError ? (
                        <InlineAlert variant="error">{publicOfferError}</InlineAlert>
                      ) : null}
                    </form>
                  </PanelSection>

                  <PanelSection className="fg-console-dialog__footer">
                    <div className="fg-console-dialog__actions">
                      <Button
                        disabled={busyAction !== null || saving}
                        onClick={() => {
                          void requestDialogDismiss(true);
                        }}
                        size="compact"
                        type="button"
                        variant="secondary"
                      >
                        {t("Cancel")}
                      </Button>

                      <Button
                        disabled={busyAction !== null || saving}
                        form={pricingDialogFormId}
                        loading={saving}
                        loadingLabel={t("Saving…")}
                        type="submit"
                        variant="primary"
                      >
                        {t("Save pricing")}
                      </Button>
                    </div>
                  </PanelSection>
                </Panel>
              </div>
            </div>,
            dialogPortalTarget,
          )
        : null}
    </>
  );
}

export function RuntimeAccessPanel({
  accessMode,
  canManagePool = false,
  canManageSharing = false,
  ownerEmail,
  ownerLabel,
  ownership,
  poolMode,
  publicOffer,
  runtimeId,
  runtimeType,
}: {
  accessMode: string | null;
  canManagePool?: boolean;
  canManageSharing?: boolean;
  ownerEmail: string | null;
  ownerLabel: string;
  ownership: RuntimeOwnership;
  poolMode: string | null;
  publicOffer: RuntimePublicOfferView | null;
  runtimeId: string | null;
  runtimeType: string | null;
}) {
  const { formatRelativeTime: formatRelativeTimeValue, locale, t } = useI18n();
  const confirm = useConfirmDialog();
  const { showToast } = useToast();
  const accessModeOptions = [
    {
      label: t("Private"),
      value: "private",
    },
    {
      label: t("Public"),
      value: "public",
    },
  ] satisfies readonly SegmentedControlOption<RuntimeAccessMode>[];
  const poolModeOptions = [
    {
      label: t("Dedicated"),
      value: "dedicated",
    },
    {
      label: t("Internal"),
      value: "internal-shared",
    },
  ] satisfies readonly SegmentedControlOption<RuntimePoolMode>[];
  const [sharing, setSharing] = useState<RuntimeSharingView | null>(null);
  const [sharingError, setSharingError] = useState<string | null>(null);
  const [loadingSharing, setLoadingSharing] = useState(() => canManageSharing);
  const [shareEmail, setShareEmail] = useState("");
  const [shareEmailError, setShareEmailError] = useState<string | undefined>();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [currentAccessMode, setCurrentAccessMode] = useState<string | null>(
    () => accessMode,
  );
  const [currentPoolMode, setCurrentPoolMode] = useState<RuntimePoolMode>(() =>
    normalizePoolMode(poolMode),
  );
  const [pricingDialogAutoOpenSignal, setPricingDialogAutoOpenSignal] =
    useState(0);
  const emailFieldId = runtimeId
    ? `${runtimeId}-share-email`
    : "runtime-share-email";
  const emailNoteId = `${emailFieldId}-note`;
  const currentPublicOffer = sharing?.publicOffer ?? publicOffer;
  const editableAccessMode = normalizeAccessMode(currentAccessMode);
  const isPublicAccess = currentAccessMode === "public";
  const grantCount = sharing?.grants.length ?? 0;
  const summaryLabel = readAccessSummaryLabel({
    accessMode: currentAccessMode,
    grantCount,
    ownership,
    poolMode: currentPoolMode,
    t,
  });
  const accessMeta = readAccessMeta({
    accessMode: currentAccessMode,
    ownerEmail,
    ownerLabel,
    ownership,
    t,
  });
  const showShareForm = ownership === "owned" && canManageSharing;
  const showPublicPricingEditor = showShareForm && isPublicAccess;
  const showPublicPricingSummary = isPublicAccess && !showPublicPricingEditor;
  const showClusterRow =
    runtimeType?.trim().toLowerCase() === "managed-owned" &&
    (ownership === "owned" || currentPoolMode === "internal-shared");
  const showVisibilitySection = showShareForm || isPublicAccess;
  const showWorkspaceAccessSection = showShareForm;
  const showInternalClusterSection =
    showClusterRow || ownership === "internal-cluster";
  const publicPricingSummary = isPublicAccess
    ? readRuntimePublicOfferSummary(currentPublicOffer, locale)
    : null;
  const publicPricingDetail = isPublicAccess
    ? readRuntimePublicOfferDescription(currentPublicOffer, locale)
    : null;
  const visibilityNote =
    currentAccessMode === "public"
      ? t(
          "Any workspace can deploy directly here. Internal cluster scheduling stays separate.",
        )
      : t("Only your workspace and direct grants can deploy here.");
  const visibilityHint =
    showShareForm && !isPublicAccess
      ? t("Pricing is configured after you switch this server to Public.")
      : null;
  const workspaceAccessNote = isPublicAccess
    ? t("Optional. Keep grants only if you may switch back to private later.")
    : t("Grant specific workspaces access without opening the server to everyone.");
  const clusterSectionNote =
    ownership === "internal-cluster"
      ? t("Managed centrally as shared system capacity.")
      : t("Separate from public deploy access.");
  const publicPricingDescription =
    publicPricingDetail ?? t("No public pricing saved yet.");
  const publicPricingMeta = currentPublicOffer?.updatedAt
    ? t("Saved {time}", {
        time: formatRecentTime(
          currentPublicOffer.updatedAt,
          formatRelativeTimeValue,
          t,
        ),
      })
    : t("Not configured yet");

  useEffect(() => {
    setCurrentAccessMode(accessMode);
    setCurrentPoolMode(normalizePoolMode(poolMode));
  }, [accessMode, poolMode, runtimeId]);

  useEffect(() => {
    if (!runtimeId || !canManageSharing) {
      return;
    }

    let cancelled = false;
    setLoadingSharing(true);
    setSharingError(null);

    requestJson<RuntimeSharingPayload>(
      `/api/fugue/runtimes/${encodeURIComponent(runtimeId)}/sharing`,
      {
        cache: "no-store",
      },
      t,
    )
      .then((data) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setSharing(data.sharing);
          setCurrentAccessMode(data.sharing.accessMode);
          setCurrentPoolMode(normalizePoolMode(data.sharing.poolMode));
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setSharingError(readErrorMessage(error, t));
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSharing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canManageSharing, runtimeId, t]);

  const applySharingUpdate = useEffectEvent((nextSharing: RuntimeSharingView) => {
    startTransition(() => {
      setSharing(nextSharing);
      setCurrentAccessMode(nextSharing.accessMode);
      setCurrentPoolMode(normalizePoolMode(nextSharing.poolMode));
    });
  });

  async function handleGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!runtimeId || busyAction) {
      return;
    }

    const nextEmail = shareEmail.trim();

    if (!nextEmail) {
      setShareEmailError(t("Enter an email address."));
      return;
    }

    setBusyAction("grant");
    setShareEmailError(undefined);

    try {
      const data = await requestJson<RuntimeSharingPayload>(
        `/api/fugue/runtimes/${encodeURIComponent(runtimeId)}/sharing/grants`,
        {
          body: JSON.stringify({ email: nextEmail }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
        t,
      );

      applySharingUpdate(data.sharing);
      setShareEmail("");
      setSharingError(null);
      showToast({
        message: t("{email} can now deploy to this server.", {
          email: nextEmail,
        }),
        variant: "success",
      });
    } catch (error) {
      setShareEmailError(readErrorMessage(error, t));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRevoke(tenantId: string, label: string) {
    if (!runtimeId || busyAction) {
      return;
    }

    const confirmed = await confirm({
      confirmLabel: t("Remove access"),
      description: t(
        "{label} will no longer be able to deploy to this server.",
        {
          label,
        },
      ),
      title: t("Remove workspace access?"),
    });

    if (!confirmed) {
      return;
    }

    setBusyAction(`revoke:${tenantId}`);

    try {
      const data = await requestJson<RuntimeSharingPayload>(
        `/api/fugue/runtimes/${encodeURIComponent(runtimeId)}/sharing/grants/${encodeURIComponent(tenantId)}`,
        {
          method: "DELETE",
        },
        t,
      );

      applySharingUpdate(data.sharing);
      setSharingError(null);
      showToast({
        message: t("{label} no longer has deploy access.", {
          label,
        }),
        variant: "success",
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error, t),
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleAccessModeChange(nextValue: RuntimeAccessMode) {
    if (
      !runtimeId ||
      busyAction ||
      nextValue === normalizeAccessMode(currentAccessMode)
    ) {
      return;
    }

    const previousValue = currentAccessMode;
    setCurrentAccessMode(nextValue);
    setBusyAction("access-mode");

    try {
      const data = await requestJson<RuntimeSharingPayload>(
        `/api/fugue/runtimes/${encodeURIComponent(runtimeId)}/sharing/mode`,
        {
          body: JSON.stringify({ access_mode: nextValue }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
        t,
      );

      applySharingUpdate(data.sharing);
      setSharingError(null);
      showToast({
        message:
          nextValue === "public"
            ? t("This server is now public to every workspace.")
            : t("This server is now private again."),
        variant: "success",
      });

      if (nextValue === "public" && canManageSharing) {
        setPricingDialogAutoOpenSignal((current) => current + 1);
      }
    } catch (error) {
      setCurrentAccessMode(previousValue);
      showToast({
        message: readErrorMessage(error, t),
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePoolModeChange(nextValue: RuntimePoolMode) {
    if (!runtimeId || busyAction || nextValue === currentPoolMode) {
      return;
    }

    const previousValue = currentPoolMode;
    setCurrentPoolMode(nextValue);
    setBusyAction("pool-mode");

    try {
      const data = await requestJson<{
        nodeReconciled: boolean;
        runtime: {
          poolMode: string | null;
        } | null;
      }>(`/api/fugue/runtimes/${encodeURIComponent(runtimeId)}/pool-mode`, {
        body: JSON.stringify({ pool_mode: nextValue }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }, t);

      const reconciledMode = normalizePoolMode(data.runtime?.poolMode);

      startTransition(() => {
        setCurrentPoolMode(reconciledMode);
        setSharing((current) =>
          current
            ? {
                ...current,
                poolMode: data.runtime?.poolMode ?? reconciledMode,
              }
            : current,
        );
      });
      showToast({
        message:
          reconciledMode === "internal-shared"
            ? data.nodeReconciled
              ? t("Internal cluster can now deploy to this server.")
              : t(
                  "Internal cluster access is enabled. Node reconciliation will follow when the server is reachable.",
                )
            : data.nodeReconciled
              ? t("Internal cluster access removed.")
              : t(
                  "Internal cluster access removed. Node reconciliation will follow when the server is reachable.",
                ),
        variant: "success",
      });
    } catch (error) {
      setCurrentPoolMode(previousValue);
      showToast({
        message: readErrorMessage(error, t),
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  if (!runtimeId) {
    return (
      <InlineAlert variant="info">
        {t(
          "Access controls become available after the runtime finishes reporting.",
        )}
      </InlineAlert>
    );
  }

  return (
    <div className="fg-runtime-access">
      <div className="fg-cluster-node-card__section-head fg-runtime-access__head">
        <div className="fg-runtime-access__copy">
          <p className="fg-label fg-panel__eyebrow">{t("Access")}</p>
        </div>

        <div className="fg-runtime-access__meta">
          {accessMeta ? (
            <span className="fg-runtime-access__meta-note">{accessMeta}</span>
          ) : null}
          <StatusBadge
            tone={
              summaryLabel === t("Private")
                ? "neutral"
                : summaryLabel === t("Cluster")
                  ? "info"
                  : "info"
            }
          >
            {summaryLabel}
          </StatusBadge>
        </div>
      </div>

      {sharingError ? (
        <InlineAlert variant="error">{sharingError}</InlineAlert>
      ) : null}

      {loadingSharing ? (
        <InlineAlert variant="info">{t("Loading access roster…")}</InlineAlert>
      ) : null}

      <div className="fg-runtime-access-sections">
        {showVisibilitySection ? (
          <AccessSection
            action={
              showShareForm ? (
                <SegmentedControl
                  ariaLabel={t("Runtime visibility")}
                  className="fg-runtime-access-section__segmented"
                  controlClassName="fg-console-nav"
                  itemClassName="fg-console-nav__link"
                  labelClassName="fg-console-nav__title"
                  onChange={handleAccessModeChange}
                  options={accessModeOptions.map((option) => ({
                    ...option,
                    disabled: busyAction !== null,
                  }))}
                  value={editableAccessMode}
                  variant="pill"
                />
              ) : isPublicAccess ? (
                <StatusBadge tone="info">{t("Public")}</StatusBadge>
              ) : null
            }
            eyebrow={t("Visibility")}
            hint={visibilityHint ?? undefined}
            note={visibilityNote}
            title={t("Choose who can deploy here")}
          >
            {isPublicAccess ? (
              <div className="fg-runtime-share-list">
                <AccessRow
                  action={
                    <RuntimePublicPricingDialogControl
                      autoOpenSignal={pricingDialogAutoOpenSignal}
                      busyAction={busyAction}
                      currentPublicOffer={currentPublicOffer}
                      onSharingUpdated={applySharingUpdate}
                      runtimeId={runtimeId}
                      showPublicPricingEditor={showPublicPricingEditor}
                    />
                  }
                  badge={
                    isRuntimePublicOfferEffectivelyFree(currentPublicOffer)
                      ? { label: t("Free"), tone: "positive" }
                      : { label: t("Reference pricing"), tone: "info" }
                  }
                  meta={`${publicPricingDescription} ${publicPricingMeta}.`}
                  title={t("Public pricing")}
                />
              </div>
            ) : null}
          </AccessSection>
        ) : null}

        {showWorkspaceAccessSection ? (
          <AccessSection
            eyebrow={t("Workspace access")}
            note={workspaceAccessNote}
            title={
              isPublicAccess
                ? t("Keep direct grants only if you need them")
                : t("Grant specific workspaces")
            }
          >
            <form className="fg-runtime-access-form" onSubmit={handleGrant}>
              <div className="fg-runtime-access-form__field">
                <div className="fg-field-label fg-runtime-access-form__label">
                  <span className="fg-field-label__main">
                    <label className="fg-field-label__text" htmlFor={emailFieldId}>
                      {t("Workspace email")}
                    </label>
                    {!shareEmailError ? (
                      <HintTooltip ariaLabel={t("Workspace email")}>
                        {isPublicAccess
                          ? t(
                              "Public access is already open to every workspace. Direct grants stay useful if you later switch back to private.",
                            )
                          : t(
                              "The recipient needs to sign in to Fugue and finish workspace setup first.",
                            )}
                      </HintTooltip>
                    ) : null}
                  </span>
                </div>

                <div className="fg-runtime-access-form__controls">
                  <span
                    className={`fg-field-control${shareEmailError ? " is-invalid" : ""}`}
                  >
                    <input
                      aria-describedby={shareEmailError ? emailNoteId : undefined}
                      aria-invalid={shareEmailError ? true : undefined}
                      autoCapitalize="none"
                      autoComplete="email"
                      className="fg-input"
                      disabled={busyAction !== null}
                      id={emailFieldId}
                      inputMode="email"
                      onChange={(event) => {
                        setShareEmail(event.target.value);
                        if (shareEmailError) {
                          setShareEmailError(undefined);
                        }
                      }}
                      placeholder="name@company.com"
                      type="email"
                      value={shareEmail}
                    />
                  </span>

                  <div className="fg-runtime-access-form__action">
                    <Button
                      disabled={busyAction !== null}
                      loading={busyAction === "grant"}
                      loadingLabel={t("Adding…")}
                      type="submit"
                      variant="primary"
                    >
                      {t("Add workspace")}
                    </Button>
                  </div>
                </div>

                {shareEmailError ? (
                  <span
                    aria-live="assertive"
                    className="fg-field-error fg-runtime-access-form__message"
                    id={emailNoteId}
                    role="alert"
                  >
                    {shareEmailError}
                  </span>
                ) : null}
              </div>
            </form>

            {showShareForm &&
            !loadingSharing &&
            !sharingError &&
            sharing &&
            sharing.grants.length > 0 ? (
              <div className="fg-runtime-share-list">
                {sharing.grants.map((grant) => (
                  <AccessRow
                    action={
                      <InlineButton
                        busy={busyAction === `revoke:${grant.tenantId}`}
                        busyLabel={t("Removing…")}
                        danger
                        disabled={
                          busyAction !== null &&
                          busyAction !== `revoke:${grant.tenantId}`
                        }
                        label={t("Remove")}
                        onClick={() => handleRevoke(grant.tenantId, grant.label)}
                      />
                    }
                    badge={{ label: t("Workspace") }}
                    key={grant.tenantId}
                    meta={
                      grant.updatedAt
                        ? t("Workspace access · updated {time}", {
                            time: formatRecentTime(
                              grant.updatedAt,
                              formatRelativeTimeValue,
                              t,
                            ),
                          })
                        : grant.createdAt
                          ? t("Workspace access · granted {time}", {
                              time: formatRecentTime(
                                grant.createdAt,
                                formatRelativeTimeValue,
                                t,
                              ),
                            })
                          : t("Workspace access")
                    }
                    title={grant.label}
                  />
                ))}
              </div>
            ) : null}

            {showShareForm &&
            !loadingSharing &&
            !sharingError &&
            sharing &&
            sharing.grants.length === 0 ? (
              <p className="fg-runtime-access-empty">
                {isPublicAccess
                  ? t("No direct workspace grants saved yet.")
                  : t("No additional workspace access yet.")}
              </p>
            ) : null}
          </AccessSection>
        ) : null}

        {showInternalClusterSection ? (
          <AccessSection
            eyebrow={t("Internal cluster")}
            note={clusterSectionNote}
            title={
              ownership === "internal-cluster"
                ? t("Managed as shared capacity")
                : t("Control internal scheduling")
            }
          >
            {ownership === "internal-cluster" ? (
              <div className="fg-runtime-share-list">
                <AccessRow
                  badge={{ label: t("System"), tone: "info" }}
                  meta={t("Shared capacity · managed centrally")}
                  title={t("Internal cluster")}
                />
              </div>
            ) : null}

            {showClusterRow ? (
              <div className="fg-runtime-share-list">
                <AccessRow
                  action={
                    canManagePool && ownership === "owned" ? (
                      <SegmentedControl
                        ariaLabel={t("Internal cluster access")}
                        className="fg-runtime-share-row__segmented"
                        controlClassName="fg-console-nav"
                        itemClassName="fg-console-nav__link"
                        labelClassName="fg-console-nav__title"
                        onChange={handlePoolModeChange}
                        options={poolModeOptions.map((option) => ({
                          ...option,
                          disabled: busyAction !== null,
                        }))}
                        value={currentPoolMode}
                        variant="pill"
                      />
                    ) : null
                  }
                  badge={
                    !canManagePool || ownership !== "owned"
                      ? {
                          label: readPoolModeLabel(currentPoolMode, t),
                          tone: readClusterTone(currentPoolMode),
                        }
                      : undefined
                  }
                  meta={readClusterMeta({
                    canManagePool,
                    ownership,
                    poolMode: currentPoolMode,
                    t,
                  })}
                  title={t("Internal cluster")}
                />
              </div>
            ) : null}
          </AccessSection>
        ) : null}
      </div>
    </div>
  );
}
