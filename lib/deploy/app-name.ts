const DEPLOY_APP_NAME_MAX_LENGTH = 50;

const DEPLOY_APP_FALLBACK_WORDS = [
  "amber",
  "cedar",
  "comet",
  "ember",
  "falcon",
  "forest",
  "harbor",
  "maple",
  "meadow",
  "nova",
  "ocean",
  "river",
  "solar",
  "stone",
  "timber",
  "violet",
] as const;

const RESERVED_DEPLOY_APP_NAMES = new Set(["item"]);

function trimTrailingDashes(value: string) {
  return value.replace(/-+$/g, "");
}

function hashDeployAppSeed(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function readFallbackWord(
  fallbackSeeds: readonly (string | null | undefined)[],
) {
  if (!DEPLOY_APP_FALLBACK_WORDS.length) {
    return "app";
  }

  const normalizedSeeds = fallbackSeeds
    .flatMap((seed) =>
      typeof seed === "string" && seed.trim() ? [seed.trim()] : [],
    )
    .join("\u0000");

  if (!normalizedSeeds) {
    const randomIndex = Math.floor(
      Math.random() * DEPLOY_APP_FALLBACK_WORDS.length,
    );

    return DEPLOY_APP_FALLBACK_WORDS[randomIndex] ?? DEPLOY_APP_FALLBACK_WORDS[0];
  }

  return (
    DEPLOY_APP_FALLBACK_WORDS[
      hashDeployAppSeed(normalizedSeeds) % DEPLOY_APP_FALLBACK_WORDS.length
    ] ?? DEPLOY_APP_FALLBACK_WORDS[0]
  );
}

export function normalizeDeployAppNameCandidate(
  value?: string | null,
) {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return "";
  }

  let output = "";
  let lastDash = false;

  for (const char of normalized) {
    const isLetter = char >= "a" && char <= "z";
    const isDigit = char >= "0" && char <= "9";

    if (isLetter || isDigit) {
      output += char;
      lastDash = false;
      continue;
    }

    if (!lastDash && output.length > 0) {
      output += "-";
      lastDash = true;
    }
  }

  const trimmed = trimTrailingDashes(
    output.replace(/^-+|-+$/g, "").slice(0, DEPLOY_APP_NAME_MAX_LENGTH),
  );

  if (!trimmed || RESERVED_DEPLOY_APP_NAMES.has(trimmed)) {
    return "";
  }

  return trimmed;
}

export function resolveDeployAppName(
  candidates: readonly (string | null | undefined)[],
  options?: {
    fallbackSeeds?: readonly (string | null | undefined)[];
  },
) {
  for (const candidate of candidates) {
    const normalized = normalizeDeployAppNameCandidate(candidate);

    if (normalized) {
      return normalized;
    }
  }

  return normalizeDeployAppNameCandidate(
    readFallbackWord(options?.fallbackSeeds ?? candidates),
  ) || "app";
}

export function readRepositoryAppNameCandidate(
  repositoryUrl?: string | null,
) {
  const value = repositoryUrl?.trim() ?? "";

  if (!value) {
    return "";
  }

  try {
    const pathname = new URL(value).pathname;
    const segments = pathname.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1] ?? "";
    return lastSegment.replace(/\.git$/i, "");
  } catch {
    return "";
  }
}

export function readImageAppNameCandidate(
  imageRef?: string | null,
) {
  let value = imageRef?.trim() ?? "";

  if (!value) {
    return "";
  }

  const digestIndex = value.indexOf("@");

  if (digestIndex >= 0) {
    value = value.slice(0, digestIndex);
  }

  const lastSlashIndex = value.lastIndexOf("/");

  if (lastSlashIndex >= 0) {
    value = value.slice(lastSlashIndex + 1);
  }

  const tagIndex = value.indexOf(":");

  if (tagIndex >= 0) {
    value = value.slice(0, tagIndex);
  }

  return value;
}

export function stripDeployArchiveExtension(value: string) {
  return value
    .replace(/\.tar\.gz$/i, "")
    .replace(/\.tgz$/i, "")
    .replace(/\.zip$/i, "")
    .replace(/\.[^.]+$/u, "");
}
