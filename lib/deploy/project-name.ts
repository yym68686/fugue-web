import "server-only";

/**
 * Auto-derive a project name from the deploy source so users don't have to
 * type one. GitHub → repo name; image → image name; upload → archive name.
 * On a per-tenant slug collision we append a deterministic-ish random word
 * (`repo-word`) and retry, mirroring the behaviour of the earlier version.
 */

const PROJECT_NAME_MAX_LENGTH = 50;

// Friendly suffix words used to disambiguate a colliding project name.
const SUFFIX_WORDS = [
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

// Mirrors the backend model.Slugify: lowercase, [a-z0-9] runs joined by single
// dashes, trimmed. Empty input collapses to "item" there, so we treat an empty
// slug as "no usable candidate" and fall back.
export function slugifyProjectName(value: string) {
  const normalized = value.trim().toLowerCase();
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

  return output.replace(/^-+|-+$/g, "").slice(0, PROJECT_NAME_MAX_LENGTH);
}

function randomSuffixWord(seed?: string | null) {
  if (seed && seed.trim()) {
    // Stable per-seed pick so re-submitting the same repo tends to suggest the
    // same alternative; a low FNV-1a hash is plenty for word selection.
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return SUFFIX_WORDS[(hash >>> 0) % SUFFIX_WORDS.length];
  }
  return SUFFIX_WORDS[Math.floor(Math.random() * SUFFIX_WORDS.length)];
}

/** Extract a name candidate from a GitHub repo URL or `owner/repo` shorthand. */
export function repoNameCandidate(repoUrlOrSlug?: string | null) {
  const value = repoUrlOrSlug?.trim() ?? "";
  if (!value) return "";

  let path = value;
  try {
    // Full URL form (https://github.com/owner/repo[.git]).
    path = new URL(value).pathname;
  } catch {
    // `owner/repo` shorthand — use as-is.
  }
  const segments = path.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  return last.replace(/\.git$/i, "");
}

/** Extract a name candidate from a container image reference. */
export function imageNameCandidate(imageRef?: string | null) {
  let value = imageRef?.trim() ?? "";
  if (!value) return "";

  const at = value.indexOf("@");
  if (at >= 0) value = value.slice(0, at); // strip @digest

  const lastSlash = value.lastIndexOf("/");
  if (lastSlash >= 0) value = value.slice(lastSlash + 1); // registry/namespace

  const colon = value.indexOf(":");
  if (colon >= 0) value = value.slice(0, colon); // strip :tag

  return value;
}

/** Extract a name candidate from an uploaded archive filename. */
export function archiveNameCandidate(fileName?: string | null) {
  const value = fileName?.trim() ?? "";
  if (!value) return "";
  return value
    .replace(/\.tar\.gz$/i, "")
    .replace(/\.tgz$/i, "")
    .replace(/\.zip$/i, "")
    .replace(/\.[^.]+$/u, "");
}

/**
 * Resolve a final project name that is unique among `existingSlugs` (the
 * caller's own tenant projects). Prefers the raw candidate; on collision
 * appends a random word, then numeric suffixes as a last resort.
 */
export function resolveUniqueProjectName(
  candidate: string,
  existingSlugs: ReadonlySet<string>,
): string {
  const baseSlug = slugifyProjectName(candidate);
  const base = baseSlug || "app";

  if (!existingSlugs.has(base)) {
    return base;
  }

  // Try a handful of random words before falling back to numeric suffixes so
  // the collision path stays human-friendly (`nextjs-blog-harbor`).
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const word = randomSuffixWord(attempt === 0 ? candidate : null);
    const withWord = slugifyProjectName(`${base}-${word}`);
    if (withWord && !existingSlugs.has(withWord)) {
      return withWord;
    }
  }

  let n = 2;
  let numbered = slugifyProjectName(`${base}-${n}`);
  while (existingSlugs.has(numbered)) {
    n += 1;
    numbered = slugifyProjectName(`${base}-${n}`);
  }
  return numbered;
}
