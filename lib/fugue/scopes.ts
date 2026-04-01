export const WORKSPACE_ADMIN_SCOPES = [
  "project.write",
  "apikey.write",
  "runtime.attach",
  "runtime.write",
  "billing.write",
  "app.write",
  "app.deploy",
  "app.scale",
  "app.migrate",
  "app.delete",
] as const;

export const FUGUE_SCOPE_CATALOG = [
  {
    description: "Create projects inside the current tenant.",
    value: "project.write",
  },
  {
    description: "Mint additional tenant access keys.",
    value: "apikey.write",
  },
  {
    description: "Create node keys and enroll external runtimes.",
    value: "runtime.attach",
  },
  {
    description: "Create or edit runtime records.",
    value: "runtime.write",
  },
  {
    description: "Change the managed billing envelope and top up tenant balance.",
    value: "billing.write",
  },
  {
    description: "Create app metadata and desired specs.",
    value: "app.write",
  },
  {
    description: "Deploy, rebuild, and restart apps.",
    value: "app.deploy",
  },
  {
    description: "Scale or disable apps.",
    value: "app.scale",
  },
  {
    description: "Move apps between runtimes.",
    value: "app.migrate",
  },
  {
    description: "Delete apps without broad write access.",
    value: "app.delete",
  },
] as const;

const scopeOrder = new Map<string, number>(
  FUGUE_SCOPE_CATALOG.map((item, index) => [item.value, index] as const),
);

export function sortFugueScopes(scopes: string[]) {
  return [...new Set(scopes)].sort((left, right) => {
    const leftOrder = scopeOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = scopeOrder.get(right) ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.localeCompare(right);
  });
}

export function getFugueScopeDescription(scope: string) {
  return (
    FUGUE_SCOPE_CATALOG.find((item) => item.value === scope)?.description ?? "Custom scope."
  );
}
