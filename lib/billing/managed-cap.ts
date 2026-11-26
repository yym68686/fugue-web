import type { BillingPriceBook, BillingResourceSpec } from "@/lib/fugue/console";

export type ManagedCap = {
  cpuMillicores: number;
  memoryMebibytes: number;
  storageGibibytes: number;
};

export function readManagedCap(value: unknown): ManagedCap | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const cap = value as ManagedCap;
  // All dimensions are required: the control plane replaces the entire cap.
  // Reject extra fields, including any client-supplied tenant or balance.
  if (Object.keys(cap).length !== 3 ||
      ![cap.cpuMillicores, cap.memoryMebibytes, cap.storageGibibytes]
        .every((amount) => Number.isSafeInteger(amount) && amount >= 0)) {
    return null;
  }
  return cap;
}

export function managedCapFromSummary(cap: BillingResourceSpec): ManagedCap {
  return {
    cpuMillicores: cap.cpu_millicores ?? 0,
    memoryMebibytes: cap.memory_mebibytes ?? 0,
    storageGibibytes: cap.storage_gibibytes ?? 0,
  };
}

export function sameManagedCap(left: ManagedCap, right: ManagedCap) {
  return left.cpuMillicores === right.cpuMillicores &&
    left.memoryMebibytes === right.memoryMebibytes &&
    left.storageGibibytes === right.storageGibibytes;
}

function readDimension(text: string, units: number) {
  if (!text.trim()) return Number.NaN;
  const value = Number(text);
  const count = Math.round(value * units);
  // Round out binary representation noise, not a fractional billable unit.
  return count / units === value ? count : Number.NaN;
}

export function readManagedCapDraft(cpuCores: string, memoryGiB: string, storageGiB: string) {
  return readManagedCap({
    cpuMillicores: readDimension(cpuCores, 1000),
    memoryMebibytes: readDimension(memoryGiB, 1024),
    storageGibibytes: readDimension(storageGiB, 1),
  });
}

export function estimateManagedCap(cap: ManagedCap, book: BillingPriceBook) {
  const rates = [
    book?.cpu_microcents_per_millicore_hour,
    book?.memory_microcents_per_mib_hour,
    book?.storage_microcents_per_gib_hour,
  ];
  const hours = book?.hours_per_month;
  if (!rates.every((rate) => Number.isSafeInteger(rate) && rate >= 0) ||
      !Number.isSafeInteger(hours) || hours <= 0) return null;

  const hourly = cap.cpuMillicores * rates[0] +
    cap.memoryMebibytes * rates[1] + cap.storageGibibytes * rates[2];
  const monthly = hourly * hours;
  return Number.isSafeInteger(hourly) && Number.isSafeInteger(monthly)
    ? { hourly, monthly }
    : null;
}
