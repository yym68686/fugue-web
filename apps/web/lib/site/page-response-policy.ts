export const PRIVATE_PAGE_CACHE_CONTROL =
  "private, no-store, no-cache, max-age=0, must-revalidate";

const LOCALIZED_PAGE_VARY_FIELDS = ["Accept-Language", "Cookie"] as const;

export function appendLocalizedPageVary(currentValue: string | null): string {
  const fields = new Map<string, string>();

  for (const field of currentValue?.split(",") ?? []) {
    const normalized = field.trim();
    if (normalized) {
      fields.set(normalized.toLowerCase(), normalized);
    }
  }

  for (const field of LOCALIZED_PAGE_VARY_FIELDS) {
    fields.set(field.toLowerCase(), field);
  }

  return [...fields.values()].join(", ");
}
