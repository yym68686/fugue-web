import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(import.meta.dir, "../../components/console/overlays.tsx"),
  "utf8",
);

function functionSource(name: string, nextName?: string) {
  const start = source.indexOf(`export function ${name}`);
  const end = nextName ? source.indexOf(`export function ${nextName}`) : source.length;

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("console overlay accessibility source contract", () => {
  test("drawers explicitly associate their title and optional descriptions", () => {
    const drawer = functionSource("ConsoleDrawer", "ConfirmationDialog");

    expect(drawer).toContain("const overlayId = useId();");
    expect(drawer).toContain("aria-labelledby={titleId}");
    expect(drawer).toContain("<DrawerTitle id={titleId}>{title}</DrawerTitle>");
    expect(drawer).toContain("description ? descriptionId : undefined");
    expect(drawer).toContain("<DrawerDescription id={descriptionId}>");
  });

  test("confirmation dialogs explicitly associate their title and description", () => {
    const confirmation = functionSource("ConfirmationDialog");

    expect(confirmation).toContain("const overlayId = useId();");
    expect(confirmation).toContain("aria-labelledby={titleId}");
    expect(confirmation).toContain(
      "<AlertDialogTitle id={titleId}>{title}</AlertDialogTitle>",
    );
    expect(confirmation).toContain("<AlertDialogDescription id={descriptionId}>");
    expect(confirmation).toMatch(
      /const describedBy = joinDescriptionIds\(\s*descriptionId,/,
    );
  });

  test("both overlays append an optional error to aria-describedby", () => {
    const drawer = functionSource("ConsoleDrawer", "ConfirmationDialog");
    const confirmation = functionSource("ConfirmationDialog");

    for (const overlay of [drawer, confirmation]) {
      expect(overlay).toContain("error?: ReactNode;");
      expect(overlay).toContain("hasError ? errorId : undefined");
      expect(overlay).toContain("aria-describedby={describedBy}");
      expect(overlay).toContain('<div id={errorId} role="alert">');
    }

    expect(source).toContain("return describedBy || undefined;");
  });

  test("drawers capture their opener before portal focus and use a connected fallback", () => {
    const drawer = functionSource("ConsoleDrawer", "ConfirmationDialog");

    expect(drawer).toContain('document.addEventListener("pointerdown"');
    expect(drawer).toContain('document.addEventListener("keydown"');
    expect(drawer).toContain("interactionTargetRef.current");
    expect(drawer).toContain("returnTarget?.isConnected");
    expect(drawer).toContain('document.getElementById("main-content")?.focus()');
  });
});
