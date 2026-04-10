import { formatNumber, translate, type Locale } from "@/lib/i18n/core";
import type { RuntimePublicOfferView } from "@/lib/runtimes/types";

export const MICRO_CENTS_PER_DOLLAR = 100_000_000;
export const MILLICORES_PER_CORE = 1000;
export const MEBIBYTES_PER_GIB = 1024;

function formatTrimmedNumber(
  value: number,
  locale: Locale | string = "en",
  maximumFractionDigits = 2,
) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatCpuLabel(cpuMillicores: number, locale: Locale = "en") {
  if (cpuMillicores <= 0) {
    return null;
  }

  return translate(locale, "{value} CPU", {
    value: formatTrimmedNumber(cpuMillicores / MILLICORES_PER_CORE, locale, 3),
  });
}

function formatMemoryLabel(memoryMebibytes: number, locale: Locale = "en") {
  if (memoryMebibytes <= 0) {
    return null;
  }

  return translate(locale, "{value} GiB", {
    value: formatTrimmedNumber(memoryMebibytes / MEBIBYTES_PER_GIB, locale, 2),
  });
}

function formatStorageLabel(storageGibibytes: number, locale: Locale = "en") {
  if (storageGibibytes <= 0) {
    return null;
  }

  return translate(locale, "{value} GiB", {
    value: formatTrimmedNumber(storageGibibytes, locale, 0),
  });
}

export function formatCurrencyFromMicroCents(
  value: number,
  currency = "USD",
  locale: Locale | string = "en",
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
    return `$${formatNumber("en", dollars, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    })}`;
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
  locale: Locale = "en",
) {
  if (!offer) {
    return null;
  }

  return [
    formatCpuLabel(offer.referenceBundle.cpuMillicores, locale),
    formatMemoryLabel(offer.referenceBundle.memoryMebibytes, locale),
    formatStorageLabel(offer.referenceBundle.storageGibibytes, locale),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" / ");
}

export function readRuntimePublicOfferFreeResourceLabels(
  offer?: RuntimePublicOfferView | null,
  locale: Locale = "en",
) {
  if (!offer || offer.free) {
    return [];
  }

  return [
    offer.freeCpu ? translate(locale, "CPU free") : null,
    offer.freeMemory ? translate(locale, "Memory free") : null,
    offer.freeStorage ? translate(locale, "Disk free") : null,
  ].filter((part): part is string => Boolean(part));
}

export function readRuntimePublicOfferSummary(
  offer?: RuntimePublicOfferView | null,
  locale: Locale = "en",
) {
  if (isRuntimePublicOfferEffectivelyFree(offer)) {
    return translate(locale, "Free");
  }

  if (!offer) {
    return translate(locale, "Free");
  }

  const priceLabel = translate(locale, "{price}/mo reference", {
    price: formatCurrencyFromMicroCents(
    offer.referenceMonthlyPriceMicroCents,
    offer.priceBook.currency,
    locale,
    ),
  });
  const bundleLabel = readRuntimePublicOfferBundleLabel(offer, locale);
  const freeLabels = readRuntimePublicOfferFreeResourceLabels(offer, locale);

  return [priceLabel, bundleLabel, ...freeLabels]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

export function readRuntimePublicOfferDescription(
  offer?: RuntimePublicOfferView | null,
  locale: Locale = "en",
) {
  if (isRuntimePublicOfferEffectivelyFree(offer)) {
    return translate(locale, "Free for all deployers.");
  }

  if (!offer) {
    return translate(locale, "Free for all deployers.");
  }

  const bundleLabel = readRuntimePublicOfferBundleLabel(offer, locale);
  const priceLabel = translate(locale, "{price}/mo", {
    price: formatCurrencyFromMicroCents(
    offer.referenceMonthlyPriceMicroCents,
    offer.priceBook.currency,
    locale,
    ),
  });
  const freeLabels = readRuntimePublicOfferFreeResourceLabels(offer, locale);
  const sentences = [
    bundleLabel
      ? translate(locale, "Reference {bundle} at {price}.", {
          bundle: bundleLabel,
          price: priceLabel,
        })
      : translate(locale, "Reference pricing starts at {price}.", {
          price: priceLabel,
        }),
    freeLabels.length > 0 ? `${freeLabels.join(", ")}.` : null,
  ];

  return sentences.filter((part): part is string => Boolean(part)).join(" ");
}
