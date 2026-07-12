export type NormalizedTemplateRouteSlug = {
  slug: string;
  redirectPath: string | null;
};

function containsForbiddenPathCharacter(value: string) {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (
      codePoint <= 0x1f ||
      codePoint === 0x7f ||
      character === "/" ||
      character === "\\"
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Next 16 exposes dynamic path segments in their URL-encoded form in this
 * route. Decode exactly one path segment before applying product
 * canonicalization; lower-casing the encoded value itself changes `%AB` to
 * `%ab` and causes an infinite redirect back to the same resource.
 */
export function normalizeTemplateRouteSlug(
  routeValue: string,
): NormalizedTemplateRouteSlug | null {
  let decoded: string;

  try {
    decoded = decodeURIComponent(routeValue);
  } catch {
    return null;
  }

  const slug = decoded.trim().toLowerCase();

  if (!slug || containsForbiddenPathCharacter(slug)) {
    return null;
  }

  return {
    slug,
    redirectPath: decoded === slug ? null : `/new/template/${encodeURIComponent(slug)}`,
  };
}
