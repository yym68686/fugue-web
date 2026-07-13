export type IdentifiedRow = {
  id: string;
};

export type EnvironmentKeyRow = IdentifiedRow & {
  key: string;
};

export function findDuplicateEnvRowIds(rows: readonly EnvironmentKeyRow[]) {
  const rowIdsByKey = new Map<string, string[]>();

  for (const row of rows) {
    const key = row.key.trim();

    if (!key) {
      continue;
    }

    const rowIds = rowIdsByKey.get(key) ?? [];
    rowIds.push(row.id);
    rowIdsByKey.set(key, rowIds);
  }

  return new Set(
    [...rowIdsByKey.values()].flatMap((rowIds) => (rowIds.length > 1 ? rowIds : [])),
  );
}

/**
 * Returns the stable row id that should receive focus after a row is removed.
 * Prefer the row that moves into the deleted row's position, then the previous
 * row. A null result means the editor should hand focus back to its add button.
 */
export function resolveEnvRowFocusAfterDelete(
  rows: readonly IdentifiedRow[],
  deletedIndex: number,
) {
  return rows[deletedIndex + 1]?.id ?? rows[deletedIndex - 1]?.id ?? null;
}
