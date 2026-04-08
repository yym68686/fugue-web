import type { RuntimePublicOfferView } from "@/lib/runtimes/types";

export const MICRO_CENTS_PER_DOLLAR = 100_000_000;
export const MILLICORES_PER_CORE = 1000;
export const MEBIBYTES_PER_GIB = 1024;

function formatTrimmedNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatCpuLabel(cpuMillicores: number) {
  if (cpuMillicores <= 0) {
    return null;
  }

  return `${formatTrimmedNumber(cpuMillicores / MILLICORES_PER_CORE, 3)} CPU`;
}

function formatMemoryLabel(memoryMebibytes: number) {
  if (memoryMebibytes <= 0) {
    return null;
  }

  return `${formatTrimmedNumber(memoryMebibytes / MEBIBYTES_PER_GIB, 2)} GiB`;
}

function formatStorageLabel(storageGibibytes: number) {
  if (storageGibibytes <= 0) {
    return null;
  }

  return `${formatTrimmedNumber(storageGibibytes, 0)} GiB`;
}

export function formatCurrencyFromMicroCents(
  value: number,
  currency = "USD",
  locale = "en-US",
) {
  const dollars = value / MICRO_CENTS_PER_DOLLAR;

  try {
    return new Intl.NumberFormat(locale, {
      currency,
      maximumFractionDigits: dollars % 1 === 0 ? 0 : 2,
      minimumFractionDigits: dollars % 1 === 0 ? 0 : 2,
      style: "currency",
    }).format(dollars);
  } catch {
    return `$${formatTrimmedNumber(dollars, 2)}`;
  }
}

export function isRuntimePublicOfferEffectivelyFree(
  offer?: RuntimePublicOfferView | null,
) {
  if (!offer) {
    return true;
  }

  if (offer.free || offer.referenceMonthlyPriceMicroCents <= 0) {
    return true;
  }

  return (
    offer.priceBook.cpuMicroCentsPerMillicoreHour <= 0 &&
    offer.priceBook.memoryMicroCentsPerMibHour <= 0 &&
    offer.priceBook.storageMicroCentsPerGibHour <= 0
  );
}

export function readRuntimePublicOfferBundleLabel(
  offer?: RuntimePublicOfferView | null,
) {
  if (!offer) {
    return null;
  }

  return [
    formatCpuLabel(offer.referenceBundle.cpuMillicores),
    formatMemoryLabel(offer.referenceBundle.memoryMebibytes),
    formatStorageLabel(offer.referenceBundle.storageGibibytes),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" / ");
}

export function readRuntimePublicOfferFreeResourceLabels(
  offer?: RuntimePublicOfferView | null,
) {
  if (!offer || offer.free) {
    return [];
  }

  return [
    offer.freeCpu ? "CPU free" : null,
    offer.freeMemory ? "Memory free" : null,
    offer.freeStorage ? "Disk free" : null,
  ].filter((part): part is string => Boolean(part));
}

export function readRuntimePublicOfferSummary(
  offer?: RuntimePublicOfferView | null,
  locale = "en-US",
) {
  if (isRuntimePublicOfferEffectivelyFree(offer)) {
    return "Free";
  }

  if (!offer) {
    return "Free";
  }

  const priceLabel = `${formatCurrencyFromMicroCents(
    offer.referenceMonthlyPriceMicroCents,
    offer.priceBook.currency,
    locale,
  )}/mo reference`;
  const bundleLabel = readRuntimePublicOfferBundleLabel(offer);
  const freeLabels = readRuntimePublicOfferFreeResourceLabels(offer);

  return [priceLabel, bundleLabel, ...freeLabels]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

export function readRuntimePublicOfferDescription(
  offer?: RuntimePublicOfferView | null,
  locale = "en-US",
) {
  if (isRuntimePublicOfferEffectivelyFree(offer)) {
    return "Free for all deployers.";
  }

  if (!offer) {
    return "Free for all deployers.";
  }

  const bundleLabel = readRuntimePublicOfferBundleLabel(offer);
  const priceLabel = `${formatCurrencyFromMicroCents(
    offer.referenceMonthlyPriceMicroCents,
    offer.priceBook.currency,
    locale,
  )}/mo`;
  const freeLabels = readRuntimePublicOfferFreeResourceLabels(offer);
  const sentences = [
    bundleLabel
      ? `Reference ${bundleLabel} at ${priceLabel}.`
      : `Reference pricing starts at ${priceLabel}.`,
    freeLabels.length > 0 ? `${freeLabels.join(", ")}.` : null,
  ];

  return sentences.filter((part): part is string => Boolean(part)).join(" ");
}
