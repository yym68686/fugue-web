import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const targetDirs = [
  path.join(repoRoot, "components/admin"),
  path.join(repoRoot, "components/console"),
];
const allowedFiles = new Set([
  path.join(repoRoot, "components/console/console-pill-switch.tsx"),
]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const nextPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return walk(nextPath);
      }

      if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) {
        return [];
      }

      return [nextPath];
    }),
  );

  return files.flat();
}

const offenders = [];

for (const targetDir of targetDirs) {
  for (const filePath of await walk(targetDir)) {
    if (allowedFiles.has(filePath)) {
      continue;
    }

    const source = await readFile(filePath, "utf8");
    const reasons = [];

    if (
      source.includes('"@/components/ui/segmented-control"') ||
      source.includes("'@/components/ui/segmented-control'")
    ) {
      reasons.push("imports raw SegmentedControl");
    }

    if (/\bSegmentedControlOption\b/.test(source)) {
      reasons.push("references SegmentedControlOption");
    }

    if (/<SegmentedControl\b/.test(source)) {
      reasons.push("renders <SegmentedControl>");
    }

    if (reasons.length > 0) {
      offenders.push({
        path: path.relative(repoRoot, filePath),
        reasons,
      });
    }
  }
}

if (offenders.length > 0) {
  console.error(
    [
      "Console/admin segmented controls must use ConsolePillSwitch.",
      "Replace raw SegmentedControl usage with components/console/console-pill-switch.tsx.",
      "",
      ...offenders.map(
        (offender) => `- ${offender.path}: ${offender.reasons.join(", ")}`,
      ),
    ].join("\n"),
  );
  process.exit(1);
}

console.log("Console/admin segmented controls are using ConsolePillSwitch.");
