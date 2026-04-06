import {
  entriesFromEnvRecord,
  parseRawEnvInput,
  serializeEnvEntries,
} from "@/lib/console/env-editor";

export type RawEnvFeedback = {
  env: Record<string, string>;
  message: string;
  valid: boolean;
  variant: "error" | "info" | "success";
};

type RawEnvRecordSuccess = {
  env: Record<string, string>;
  ignoredLineCount: number;
  ok: true;
};

type RawEnvRecordError = {
  line: number;
  message: string;
  ok: false;
};

export type RawEnvRecordResult = RawEnvRecordError | RawEnvRecordSuccess;

type RawEnvSurface = "console" | "deploy";

export function serializeEnvRecord(env: Record<string, string>) {
  return serializeEnvEntries(entriesFromEnvRecord(env));
}

export function parseRawEnvRecord(input: string): RawEnvRecordResult {
  const parsed = parseRawEnvInput(input);

  if (!parsed.ok) {
    return parsed;
  }

  return {
    env: Object.fromEntries(
      parsed.entries.map((entry) => [entry.key, entry.value]),
    ) as Record<string, string>,
    ignoredLineCount: parsed.ignoredLineCount,
    ok: true,
  };
}

function buildIgnoredSuffix(ignoredLineCount: number) {
  return ignoredLineCount
    ? ` ${ignoredLineCount} comment or blank line${
        ignoredLineCount === 1 ? "" : "s"
      } ignored.`
    : "";
}

function buildEmptyMessage(
  surface: RawEnvSurface,
  ignoredLineCount: number,
) {
  const base =
    surface === "deploy"
      ? "No environment variables will be set on the first deploy."
      : "No environment variables will be applied on the first deploy.";

  if (surface === "deploy") {
    return `${base}${buildIgnoredSuffix(ignoredLineCount)} Keep secrets out of deploy links.`;
  }

  return `${base}${buildIgnoredSuffix(ignoredLineCount)}`;
}

function buildSuccessMessage(
  count: number,
  surface: RawEnvSurface,
  ignoredLineCount: number,
) {
  const base = `${count} environment variable${
    count === 1 ? "" : "s"
  } ready for the first deploy.${buildIgnoredSuffix(ignoredLineCount)}`;

  if (surface === "deploy") {
    return `${base} Keep secrets out of deploy links.`;
  }

  return base;
}

export function buildRawEnvFeedback(
  input: string,
  surface: RawEnvSurface = "console",
): RawEnvFeedback {
  if (!input.trim()) {
    return {
      env: {},
      message: buildEmptyMessage(surface, 0),
      valid: true,
      variant: "info",
    };
  }

  const parsed = parseRawEnvRecord(input);

  if (!parsed.ok) {
    return {
      env: {},
      message: `Line ${parsed.line}: ${parsed.message}`,
      valid: false,
      variant: "error",
    };
  }

  const envCount = Object.keys(parsed.env).length;

  if (envCount === 0) {
    return {
      env: {},
      message: buildEmptyMessage(surface, parsed.ignoredLineCount),
      valid: true,
      variant: "info",
    };
  }

  return {
    env: parsed.env,
    message: buildSuccessMessage(envCount, surface, parsed.ignoredLineCount),
    valid: true,
    variant: "success",
  };
}
