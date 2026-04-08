"use client";

import {
  startTransition,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { StatusBadge } from "@/components/console/status-badge";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button, InlineButton } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  SegmentedControl,
  type SegmentedControlOption,
} from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import type { TranslationValues } from "@/lib/i18n/core";
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

function readErrorMessage(error: unknown, t: Translator = (key) => key) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return t("Request failed.");
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

function formatRelativeTime(
  value: string | null | undefined,
  formatter: (
    value?: string | number | Date | null,
    options?: {
      justNowText?: string;
      notYetText?: string;
    },
  ) => string,
) {
  if (!value) {
    return formatter(null, { notYetText: "Just now" });
  }
  return formatter(value, {
    justNowText: "Just now",
    notYetText: "Just now",
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

function parseNonNegativeDecimal(value: string, maximumDecimals = 3) {
  const normalized = value.trim();

  if (!normalized) {
    return {
      valid: true,
      value: null,
    } as const;
  }

  const pattern = new RegExp(`^\\d+(?:\\.\\d{1,${maximumDecimals}})?$`);

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
  locale = "en-US",
) {
  if (draft.free) {
    return "Free for all deployers.";
  }

  const cpu = parseNonNegativeDecimal(draft.referenceCpuCores, 3);
  const memory = parseNonNegativeDecimal(draft.referenceMemoryGib, 2);
  const storage = parseNonNegativeDecimal(draft.referenceStorageGib, 0);
  const price = parseUsdValue(draft.referenceMonthlyPriceUsd);
  const bundle = [
    cpu.value && cpu.value > 0
      ? `${formatDraftNumber(cpu.value, 3)} CPU`
      : null,
    memory.value && memory.value > 0
      ? `${formatDraftNumber(memory.value, 2)} GiB`
      : null,
    storage.value && storage.value > 0
      ? `${formatDraftNumber(storage.value, 0)} GiB`
      : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" / ");
  const freeParts = [
    draft.freeCpu ? "CPU free" : null,
    draft.freeMemory ? "Memory free" : null,
    draft.freeStorage ? "Disk free" : null,
  ].filter((part): part is string => Boolean(part));
  const priceLabel =
    price.valid && price.value && price.value > 0
      ? `${formatCurrencyFromMicroCents(price.value, "USD", locale)}/mo reference`
      : "Reference price not set";

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
    freeCpu: draft.freeCpu,
    freeMemory: draft.freeMemory,
    freeStorage: draft.freeStorage,
    referenceBundle: {
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

    if (ownership === "owned") {
      return t("Any workspace can deploy here.");
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
  const [publicOfferDraft, setPublicOfferDraft] = useState<PublicOfferDraft>(
    () => buildPublicOfferDraft(publicOffer),
  );
  const [publicOfferErrors, setPublicOfferErrors] =
    useState<PublicOfferFieldErrors>({});
  const [publicOfferError, setPublicOfferError] = useState<string | null>(null);
  const emailFieldId = runtimeId
    ? `${runtimeId}-share-email`
    : "runtime-share-email";
  const emailNoteId = `${emailFieldId}-note`;
  const publicOfferBaseId = runtimeId
    ? `${runtimeId}-public-offer`
    : "runtime-public-offer";
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
  const showClusterRow =
    runtimeType?.trim().toLowerCase() === "managed-owned" &&
    (ownership === "owned" || currentPoolMode === "internal-shared");
  const publicPricingSummary = isPublicAccess
    ? readRuntimePublicOfferSummary(currentPublicOffer, locale)
    : null;
  const publicPricingDetail = isPublicAccess
    ? readRuntimePublicOfferDescription(currentPublicOffer, locale)
    : null;
  const publicOfferPreview = readDraftPublicOfferSummary(
    publicOfferDraft,
    locale,
  );

  useEffect(() => {
    setCurrentAccessMode(accessMode);
    setCurrentPoolMode(normalizePoolMode(poolMode));
  }, [accessMode, poolMode, runtimeId]);

  useEffect(() => {
    setPublicOfferDraft(buildPublicOfferDraft(publicOffer));
    setPublicOfferErrors({});
    setPublicOfferError(null);
  }, [publicOffer, runtimeId]);

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
    )
      .then((data) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setSharing(data.sharing);
          setCurrentAccessMode(data.sharing.accessMode);
          setCurrentPoolMode(normalizePoolMode(data.sharing.poolMode));
          setPublicOfferDraft(buildPublicOfferDraft(data.sharing.publicOffer));
          setPublicOfferErrors({});
          setPublicOfferError(null);
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
      );

      startTransition(() => {
        setSharing(data.sharing);
        setCurrentAccessMode(data.sharing.accessMode);
        setCurrentPoolMode(normalizePoolMode(data.sharing.poolMode));
        setPublicOfferDraft(buildPublicOfferDraft(data.sharing.publicOffer));
        setShareEmail("");
      });
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
      );

      startTransition(() => {
        setSharing(data.sharing);
        setCurrentAccessMode(data.sharing.accessMode);
        setCurrentPoolMode(normalizePoolMode(data.sharing.poolMode));
        setPublicOfferDraft(buildPublicOfferDraft(data.sharing.publicOffer));
      });
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
      );

      startTransition(() => {
        setSharing(data.sharing);
        setCurrentAccessMode(data.sharing.accessMode);
        setCurrentPoolMode(normalizePoolMode(data.sharing.poolMode));
        setPublicOfferDraft(buildPublicOfferDraft(data.sharing.publicOffer));
        setPublicOfferErrors({});
        setPublicOfferError(null);
      });
      setSharingError(null);
      showToast({
        message:
          nextValue === "public"
            ? t("This server is now public to every workspace.")
            : t("This server is now private again."),
        variant: "success",
      });
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

  async function handlePublicOfferSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!runtimeId || busyAction) {
      return;
    }

    const errors = buildPublicOfferFieldErrors(publicOfferDraft, t);
    setPublicOfferErrors(errors);

    if (hasPublicOfferFieldErrors(errors)) {
      return;
    }

    setBusyAction("public-offer");
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
      );

      startTransition(() => {
        setSharing(data.sharing);
        setCurrentAccessMode(data.sharing.accessMode);
        setCurrentPoolMode(normalizePoolMode(data.sharing.poolMode));
        setPublicOfferDraft(buildPublicOfferDraft(data.sharing.publicOffer));
        setPublicOfferErrors({});
      });
      setSharingError(null);
      showToast({
        message: t("Public pricing saved."),
        variant: "success",
      });
    } catch (error) {
      setPublicOfferError(readErrorMessage(error, t));
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
      });

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

      <div className="fg-runtime-share-list">
        {showShareForm || isPublicAccess ? (
          <AccessRow
            action={
              showShareForm ? (
                <SegmentedControl
                  ariaLabel={t("Runtime visibility")}
                  className="fg-runtime-share-row__segmented"
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
              ) : null
            }
            badge={
              !showShareForm
                ? {
                    label:
                      currentAccessMode === "public"
                        ? t("Public")
                        : t("Private"),
                    tone: currentAccessMode === "public" ? "info" : "neutral",
                  }
                : undefined
            }
            meta={
              currentAccessMode === "public"
                ? t(
                    "Any workspace can deploy here. Internal cluster scheduling stays separate.",
                  )
                : t(
                    "Only your workspace and direct grants can deploy here. Internal cluster scheduling stays separate.",
                  )
            }
            title={t("Visibility")}
          />
        ) : null}

        {isPublicAccess ? (
          <AccessRow
            badge={
              isRuntimePublicOfferEffectivelyFree(currentPublicOffer)
                ? { label: t("Free"), tone: "positive" }
                : { label: t("Reference pricing"), tone: "info" }
            }
            meta={
              currentPublicOffer?.updatedAt
                ? `${publicPricingDetail} ${t("Updated {time}.", {
                    time: formatRelativeTime(
                      currentPublicOffer.updatedAt,
                      formatRelativeTimeValue,
                    ),
                  })}`
                : (publicPricingDetail ?? undefined)
            }
            title={publicPricingSummary ?? t("Public pricing")}
          />
        ) : null}

        {showClusterRow ? (
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
        ) : null}

        {ownership === "internal-cluster" ? (
          <AccessRow
            badge={{ label: t("System"), tone: "info" }}
            meta={t("Shared capacity · managed centrally")}
            title={t("Internal cluster")}
          />
        ) : null}

        {showShareForm &&
        !loadingSharing &&
        sharing &&
        sharing.grants.length > 0
          ? sharing.grants.map((grant) => (
              <AccessRow
                action={
                  <InlineButton
                    busy={busyAction === `revoke:${grant.tenantId}`}
                    busyLabel={t("Removing...")}
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
                        time: formatRelativeTime(
                          grant.updatedAt,
                          formatRelativeTimeValue,
                        ),
                      })
                    : grant.createdAt
                      ? t("Workspace access · granted {time}", {
                          time: formatRelativeTime(
                            grant.createdAt,
                            formatRelativeTimeValue,
                          ),
                        })
                      : t("Workspace access")
                }
                title={grant.label}
              />
            ))
          : null}
      </div>

      {showPublicPricingEditor ? (
        <form
          className="fg-runtime-public-offer"
          onSubmit={handlePublicOfferSave}
        >
          <div className="fg-runtime-public-offer__head">
            <div>
              <p className="fg-label fg-panel__eyebrow">
                {t("Public pricing")}
              </p>
              <p className="fg-console-note">
                {t(
                  "Set one reference bundle and monthly price. Fugue derives unit CPU, memory, and disk pricing from it.",
                )}
              </p>
            </div>

            <StatusBadge
              tone={
                publicOfferDraft.free ||
                isRuntimePublicOfferEffectivelyFree(currentPublicOffer)
                  ? "positive"
                  : "info"
              }
            >
              {publicOfferPreview}
            </StatusBadge>
          </div>

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
                disabled={busyAction !== null || publicOfferDraft.free}
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
                disabled={busyAction !== null || publicOfferDraft.free}
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
                disabled={busyAction !== null || publicOfferDraft.free}
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
                disabled={busyAction !== null || publicOfferDraft.free}
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

          <div className="fg-runtime-public-offer__toggles">
            <label className="fg-project-toggle fg-runtime-public-offer__toggle">
              <input
                checked={publicOfferDraft.free}
                disabled={busyAction !== null}
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
              <span>{t("Free for everyone")}</span>
            </label>

            <label className="fg-project-toggle fg-runtime-public-offer__toggle">
              <input
                checked={publicOfferDraft.freeCpu}
                disabled={busyAction !== null || publicOfferDraft.free}
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
                disabled={busyAction !== null || publicOfferDraft.free}
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
                disabled={busyAction !== null || publicOfferDraft.free}
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

          <div className="fg-runtime-public-offer__footer">
            <p className="fg-runtime-public-offer__note">
              {currentPublicOffer?.updatedAt
                ? t("Last saved {time}.", {
                    time: formatRelativeTime(
                      currentPublicOffer.updatedAt,
                      formatRelativeTimeValue,
                    ),
                  })
                : t("No public pricing saved yet.")}
            </p>

            <Button
              disabled={busyAction !== null}
              loading={busyAction === "public-offer"}
              loadingLabel={t("Saving...")}
              type="submit"
              variant="primary"
            >
              {t("Save pricing")}
            </Button>
          </div>

          {publicOfferError ? (
            <InlineAlert variant="error">{publicOfferError}</InlineAlert>
          ) : null}
        </form>
      ) : null}

      {showShareForm ? (
        <form className="fg-runtime-access-form" onSubmit={handleGrant}>
          <div className="fg-runtime-access-form__field">
            <label
              className="fg-field-label fg-runtime-access-form__label"
              htmlFor={emailFieldId}
            >
              <span>{t("Workspace email")}</span>
            </label>

            <div className="fg-runtime-access-form__controls">
              <span
                className={`fg-field-control${shareEmailError ? " is-invalid" : ""}`}
              >
                <input
                  aria-describedby={emailNoteId}
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
                  loadingLabel={t("Adding...")}
                  type="submit"
                  variant="primary"
                >
                  {t("Add workspace")}
                </Button>
              </div>
            </div>

            <span
              aria-live={shareEmailError ? "assertive" : "polite"}
              className={
                shareEmailError
                  ? "fg-field-error fg-runtime-access-form__message"
                  : "fg-field-hint fg-runtime-access-form__message"
              }
              id={emailNoteId}
              role={shareEmailError ? "alert" : undefined}
            >
              {shareEmailError ??
                (isPublicAccess
                  ? t(
                      "Public access is already open to every workspace. Direct grants stay useful if you later switch back to private.",
                    )
                  : t(
                      "The recipient needs to sign in to Fugue and finish workspace setup first.",
                    ))}
            </span>
          </div>
        </form>
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
    </div>
  );
}
