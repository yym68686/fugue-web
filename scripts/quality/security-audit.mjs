import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { finishGate, parseArgs, ROOT } from "./lib.mjs";
import { scanSecretOutput } from "./secret-output-scan.mjs";

const BLOCKING_SEVERITIES = new Set(["critical", "high"]);
const args = parseArgs();
const errors = [];
const homeBun = process.env.HOME ? join(process.env.HOME, ".bun", "bin", "bun") : null;
const bunExecutable = process.versions.bun
  ? process.execPath
  : homeBun && existsSync(homeBun)
    ? homeBun
    : "bun";
const audit = spawnSync(bunExecutable, ["audit", "--json"], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
});
const outputSecretScan = scanSecretOutput(
  `${audit.stdout ?? ""}\n${audit.stderr ?? ""}`,
);

if (audit.error) {
  errors.push(`Bun audit could not start: ${audit.error.message}`);
}

if (outputSecretScan.total > 0) {
  errors.push(
    `Bun audit output contained ${outputSecretScan.total} possible secret(s)`,
  );
}

let advisoriesByPackage = {};
if (!audit.error) {
  try {
    advisoriesByPackage = JSON.parse(audit.stdout.trim() || "{}");
  } catch (error) {
    errors.push(`Bun audit returned invalid JSON: ${error.message}`);
  }
}

const advisories = [];
for (const [packageName, packageAdvisories] of Object.entries(advisoriesByPackage)) {
  if (!Array.isArray(packageAdvisories)) {
    errors.push(`Bun audit returned an invalid advisory list for ${packageName}`);
    continue;
  }
  for (const advisory of packageAdvisories) {
    const normalized = {
      ...advisory,
      package: packageName,
      severity: String(advisory.severity ?? "unknown").toLowerCase(),
    };
    advisories.push(normalized);
    if (BLOCKING_SEVERITIES.has(normalized.severity)) {
      errors.push(
        `${normalized.severity.toUpperCase()} ${packageName}: ${normalized.id ?? normalized.title ?? "unknown advisory"}`,
      );
    }
  }
}

const counts = Object.fromEntries(
  ["critical", "high", "moderate", "low", "unknown"].map((severity) => [
    severity,
    advisories.filter((advisory) => advisory.severity === severity).length,
  ]),
);
const report = {
  schemaVersion: 1,
  gate: "production-dependency-audit",
  scope:
    "complete Bun lockfile (production dependencies plus development dependencies; a strict superset of production)",
  blockingSeverities: [...BLOCKING_SEVERITIES],
  passed: errors.length === 0,
  counts,
  outputSecretScan,
  advisories: advisories.sort((left, right) =>
    `${left.severity}:${left.package}`.localeCompare(
      `${right.severity}:${right.package}`,
    ),
  ),
  violations: errors,
};

console.log(
  `Audit: ${counts.critical} critical, ${counts.high} high, ${counts.moderate} moderate, ${counts.low} low`,
);
finishGate("Production dependency audit", errors, report, args.value("report"));
