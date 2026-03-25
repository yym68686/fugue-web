export type EnvEntry = {
  key: string;
  value: string;
};

export type EnvDraftRow = {
  existing: boolean;
  key: string;
  originalKey: string;
  originalValue: string;
  removed: boolean;
  value: string;
};

type EnvRawParseSuccess = {
  entries: EnvEntry[];
  ignoredLineCount: number;
  ok: true;
};

type EnvRawParseError = {
  line: number;
  message: string;
  ok: false;
};

export type EnvRawParseResult = EnvRawParseError | EnvRawParseSuccess;

function normalizeEnvSource(input: string) {
  return input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

function isEscaped(value: string, index: number) {
  let slashCount = 0;

  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }

  return slashCount % 2 === 1;
}

function findClosingQuote(value: string, quote: '"' | "'") {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === quote && !isEscaped(value, index)) {
      return index;
    }
  }

  return -1;
}

function decodeDoubleQuotedValue(value: string) {
  return value.replace(/\\([\\nrt"])/g, (_, token: string) => {
    switch (token) {
      case "\\":
        return "\\";
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      case '"':
        return '"';
      default:
        return token;
    }
  });
}

function stripInlineComment(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "#") {
      continue;
    }

    if (index === 0 || /\s/.test(value[index - 1])) {
      return value.slice(0, index).trimEnd();
    }
  }

  return value.trimEnd();
}

function parseQuotedValue(
  initialValue: string,
  lines: string[],
  startIndex: number,
  quote: '"' | "'",
) {
  let cursor = startIndex;
  let segment = initialValue.slice(1);
  let collected = "";

  while (true) {
    const closingIndex = findClosingQuote(segment, quote);

    if (closingIndex >= 0) {
      collected += segment.slice(0, closingIndex);

      const trailing = segment.slice(closingIndex + 1).trim();

      if (trailing.length > 0 && !trailing.startsWith("#")) {
        return {
          message: "Unexpected characters after the quoted value. Use key=value or move comments onto their own line.",
          ok: false as const,
        };
      }

      return {
        nextIndex: cursor,
        ok: true as const,
        value: quote === '"' ? decodeDoubleQuotedValue(collected) : collected,
      };
    }

    cursor += 1;

    if (cursor >= lines.length) {
      return {
        message: "Missing closing quote in raw environment input.",
        ok: false as const,
      };
    }

    collected += segment;
    collected += "\n";
    segment = lines[cursor];
  }
}

function parseValue(rawValue: string, lines: string[], lineIndex: number) {
  const nextValue = rawValue.replace(/^\s+/, "");

  if (nextValue.startsWith('"') || nextValue.startsWith("'")) {
    return parseQuotedValue(nextValue, lines, lineIndex, nextValue[0] as '"' | "'");
  }

  return {
    nextIndex: lineIndex,
    ok: true as const,
    value: stripInlineComment(nextValue),
  };
}

export function parseRawEnvInput(input: string): EnvRawParseResult {
  const lines = normalizeEnvSource(input).split("\n");
  const entries: EnvEntry[] = [];
  const seenKeys = new Map<string, number>();
  let ignoredLineCount = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = index === 0 ? rawLine.replace(/^\uFEFF/, "") : rawLine;
    const trimmed = line.trim();
    const startLine = index + 1;

    if (!trimmed) {
      ignoredLineCount += 1;
      continue;
    }

    if (trimmed.startsWith("#")) {
      ignoredLineCount += 1;
      continue;
    }

    const withoutExport = line.replace(/^\s*export\s+/, "");
    const separatorIndex = withoutExport.indexOf("=");

    if (separatorIndex < 0) {
      return {
        line: startLine,
        message: "Each line must use key=value format.",
        ok: false,
      };
    }

    const key = withoutExport.slice(0, separatorIndex).trim();

    if (!key) {
      return {
        line: startLine,
        message: "Environment variable names cannot be empty.",
        ok: false,
      };
    }

    if (seenKeys.has(key)) {
      const firstLine = seenKeys.get(key);

      return {
        line: startLine,
        message: `Duplicate variable "${key}" found. The first copy is on line ${firstLine}.`,
        ok: false,
      };
    }

    const parsedValue = parseValue(withoutExport.slice(separatorIndex + 1), lines, index);

    if (!parsedValue.ok) {
      return {
        line: startLine,
        message: parsedValue.message,
        ok: false,
      };
    }

    index = parsedValue.nextIndex;
    seenKeys.set(key, startLine);
    entries.push({
      key,
      value: parsedValue.value,
    });
  }

  return {
    entries,
    ignoredLineCount,
    ok: true,
  };
}

function escapeEnvValue(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/"/g, '\\"');
}

function serializeEnvValue(value: string) {
  if (!value) {
    return "";
  }

  if (/^[^\s"'\\#]+$/.test(value)) {
    return value;
  }

  return `"${escapeEnvValue(value)}"`;
}

export function serializeEnvEntries(entries: EnvEntry[]) {
  return entries
    .map(({ key, value }) => `${key}=${serializeEnvValue(value)}`)
    .join("\n");
}

export function entriesFromEnvRecord(env: Record<string, string>) {
  return Object.entries(env)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({
      key,
      value,
    }));
}

export function buildEnvDraftRowsFromEntries(
  entries: EnvEntry[],
  baselineEnv: Record<string, string>,
) {
  const remaining = new Map(Object.entries(baselineEnv));
  const rows: EnvDraftRow[] = [];

  for (const entry of entries) {
    if (remaining.has(entry.key)) {
      const originalValue = remaining.get(entry.key) ?? "";
      remaining.delete(entry.key);

      rows.push({
        existing: true,
        key: entry.key,
        originalKey: entry.key,
        originalValue,
        removed: false,
        value: entry.value,
      });
      continue;
    }

    rows.push({
      existing: false,
      key: entry.key,
      originalKey: "",
      originalValue: "",
      removed: false,
      value: entry.value,
    });
  }

  for (const [key, value] of [...remaining.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    rows.push({
      existing: true,
      key,
      originalKey: key,
      originalValue: value,
      removed: true,
      value,
    });
  }

  return rows;
}
