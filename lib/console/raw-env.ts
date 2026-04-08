import {
  entriesFromEnvRecord,
  parseRawEnvInput,
  serializeEnvEntries,
} from "@/lib/console/env-editor";
import { translate, type Locale } from "@/lib/i18n/core";

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

function buildIgnoredSuffix(locale: Locale, ignoredLineCount: number) {
  return ignoredLineCount
    ? ` ${translate(
        locale,
        ignoredLineCount === 1
          ? "{count} comment or blank line ignored."
          : "{count} comment or blank lines ignored.",
        {
          count: ignoredLineCount,
        },
      )}`
    : "";
}

function buildEmptyMessage(
  surface: RawEnvSurface,
  ignoredLineCount: number,
  locale: Locale,
) {
  const base =
    surface === "deploy"
      ? translate(locale, "No environment variables will be set on the first deploy.")
      : translate(
          locale,
          "No environment variables will be applied on the first deploy.",
        );

  if (surface === "deploy") {
    return `${base}${buildIgnoredSuffix(locale, ignoredLineCount)} ${translate(
      locale,
      "Keep secrets out of deploy links.",
    )}`;
  }

  return `${base}${buildIgnoredSuffix(locale, ignoredLineCount)}`;
}

function buildSuccessMessage(
  count: number,
  surface: RawEnvSurface,
  ignoredLineCount: number,
  locale: Locale,
) {
  const base = `${translate(
    locale,
    count === 1
      ? "{count} environment variable ready for the first deploy."
      : "{count} environment variables ready for the first deploy.",
    { count },
  )}${buildIgnoredSuffix(locale, ignoredLineCount)}`;

  if (surface === "deploy") {
    return `${base} ${translate(locale, "Keep secrets out of deploy links.")}`;
  }

  return base;
}

export function buildRawEnvFeedback(
  input: string,
  surface: RawEnvSurface = "console",
  locale: Locale = "en",
): RawEnvFeedback {
  if (!input.trim()) {
    return {
      env: {},
      message: buildEmptyMessage(surface, 0, locale),
      valid: true,
      variant: "info",
    };
  }

  const parsed = parseRawEnvRecord(input);

  if (!parsed.ok) {
    return {
      env: {},
      message: translate(locale, "Line {line}: {message}", {
        line: parsed.line,
        message: parsed.message,
      }),
      valid: false,
      variant: "error",
    };
  }

  const envCount = Object.keys(parsed.env).length;

  if (envCount === 0) {
    return {
      env: {},
      message: buildEmptyMessage(surface, parsed.ignoredLineCount, locale),
      valid: true,
      variant: "info",
    };
  }

  return {
    env: parsed.env,
    message: buildSuccessMessage(
      envCount,
      surface,
      parsed.ignoredLineCount,
      locale,
    ),
    valid: true,
    variant: "success",
  };
}
