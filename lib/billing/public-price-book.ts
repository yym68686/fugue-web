import "server-only";

import type { BillingPriceBook } from "@/lib/fugue/console";

export type PublicPriceBook = BillingPriceBook & { effective_date: string };

// Display-only runtime configuration. The control plane remains the billing
// authority; never turn a missing or malformed publication into a zero price.
export function parsePublicPriceBook(raw: string | undefined): PublicPriceBook | null {
  if (!raw) return null;
  try {
    const book = JSON.parse(raw) as PublicPriceBook;
    if (!book || book.currency !== "USD") return null;
    const date = book.effective_date;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        new Date(date).toISOString().slice(0, 10) !== date) return null;
    const rates = [book.cpu_microcents_per_millicore_hour,
      book.memory_microcents_per_mib_hour, book.storage_microcents_per_gib_hour];
    if (!rates.every((value) => Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000)) return null;
    if (!Number.isSafeInteger(book.hours_per_month) || book.hours_per_month < 1 || book.hours_per_month > 744) return null;
    return {
      currency: book.currency,
      effective_date: date,
      hours_per_month: book.hours_per_month,
      cpu_microcents_per_millicore_hour: book.cpu_microcents_per_millicore_hour,
      memory_microcents_per_mib_hour: book.memory_microcents_per_mib_hour,
      storage_microcents_per_gib_hour: book.storage_microcents_per_gib_hour,
    };
  } catch {
    return null;
  }
}

export function getPublicPriceBook(): PublicPriceBook | null {
  return parsePublicPriceBook(process.env.FUGUE_PUBLIC_PRICE_BOOK);
}
