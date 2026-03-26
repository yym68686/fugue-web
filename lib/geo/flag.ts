const REGIONAL_INDICATOR_A = 0x1f1e6;
const ASCII_A = 65;

export function countryCodeToFlagEmoji(countryCode?: string | null) {
  const normalized = countryCode?.trim().toUpperCase();

  if (!normalized || !/^[A-Z]{2}$/.test(normalized)) {
    return null;
  }

  return [...normalized]
    .map((character) => String.fromCodePoint(REGIONAL_INDICATOR_A + character.charCodeAt(0) - ASCII_A))
    .join("");
}
