function normalizeRuntimeStatus(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function isRuntimeSelectableForDeployment(status?: string | null) {
  const normalized = normalizeRuntimeStatus(status);

  if (!normalized) {
    return true;
  }

  return !normalized.includes("offline");
}
