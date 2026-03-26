import type { NodeKeyRecord } from "@/lib/node-keys/types";

export function sortNodeKeys(keys: NodeKeyRecord[]) {
  const statusOrder = new Map<NodeKeyRecord["status"], number>([
    ["active", 0],
    ["revoked", 1],
  ]);

  return [...keys].sort((left, right) => {
    const leftStatusOrder = statusOrder.get(left.status) ?? Number.MAX_SAFE_INTEGER;
    const rightStatusOrder = statusOrder.get(right.status) ?? Number.MAX_SAFE_INTEGER;

    if (leftStatusOrder !== rightStatusOrder) {
      return leftStatusOrder - rightStatusOrder;
    }

    const leftCreatedAt = Date.parse(left.createdAt);
    const rightCreatedAt = Date.parse(right.createdAt);

    if (
      Number.isFinite(leftCreatedAt) &&
      Number.isFinite(rightCreatedAt) &&
      leftCreatedAt !== rightCreatedAt
    ) {
      return rightCreatedAt - leftCreatedAt;
    }

    return left.label.localeCompare(right.label);
  });
}

export function canUseNodeKeyForClusterJoin(key: NodeKeyRecord) {
  return key.status === "active" && key.canCopy;
}
