import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  findDuplicateEnvRowIds,
  resolveEnvRowFocusAfterDelete,
} from "@/lib/ui/env-row-focus";

const rows = [{ id: "first" }, { id: "middle" }, { id: "last" }] as const;

describe("environment editor focus handoff", () => {
  test("returns every stable row id participating in a non-empty duplicate key", () => {
    expect([
      ...findDuplicateEnvRowIds([
        { id: "blank", key: "   " },
        { id: "first-api", key: " API_URL " },
        { id: "single", key: "NODE_ENV" },
        { id: "second-api", key: "API_URL" },
        { id: "third-api", key: "API_URL" },
      ]),
    ]).toEqual(["first-api", "second-api", "third-api"]);
  });

  test("does not mark blank or unique environment keys as duplicates", () => {
    expect(
      findDuplicateEnvRowIds([
        { id: "first", key: "" },
        { id: "second", key: "   " },
        { id: "third", key: "API_URL" },
      ]).size,
    ).toBe(0);
  });

  test("prefers the row that moves into a deleted row's position", () => {
    expect(resolveEnvRowFocusAfterDelete(rows, 1)).toBe("last");
  });

  test("falls back to the previous row, then the add control", () => {
    expect(resolveEnvRowFocusAfterDelete(rows, 2)).toBe("middle");
    expect(resolveEnvRowFocusAfterDelete([{ id: "only" }], 0)).toBeNull();
  });

  test("keeps stable row identities and performs focus only after structural edits", async () => {
    const source = await readFile(
      path.join(import.meta.dir, "../../components/fugue-coss/new-project-wizard.tsx"),
      "utf8",
    );

    expect(source).toContain("<tr key={row.id}>");
    expect(source).toMatch(/name=\{`environmentKey-\$\{row\.id\}`\}/);
    expect(source).toContain(
      'pendingFocusRef.current = { kind: "row", rowId: row.id }',
    );
    expect(source).toContain("onClick={() => deleteRow(row.index)}");
    expect(source).toContain("keyInputRefs.current.get(pendingFocus.rowId)?.focus()");
    expect(source).toContain("addButtonRef.current?.focus()");
    expect(source).toContain("findDuplicateEnvRowIds(envRows)");
    expect(source).toContain('setDrawer("env")');
    expect(source).toContain("setEnvFocusRowId(duplicateRowId)");
    expect(source).toContain("aria-invalid={duplicateKey || undefined}");
    expect(source).toContain(
      "aria-describedby={duplicateKey ? duplicateErrorId : undefined}",
    );
    expect(source).toContain('<FieldError id={duplicateErrorId} match role="alert">');
    expect(source).not.toContain("aria-selected=");
  });
});
