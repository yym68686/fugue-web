const HTML_TEXT_REPLACEMENTS: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

const HTML_ATTRIBUTE_REPLACEMENTS: Record<string, string> = {
  ...HTML_TEXT_REPLACEMENTS,
  '"': "&quot;",
  "'": "&#39;",
  "`": "&#96;",
};

export function escapeHtmlText(value: string) {
  return value.replace(
    /[&<>]/g,
    (character) => HTML_TEXT_REPLACEMENTS[character] ?? character,
  );
}

export function escapeHtmlAttribute(value: string) {
  return value.replace(
    /[&<>"'`]/g,
    (character) => HTML_ATTRIBUTE_REPLACEMENTS[character] ?? character,
  );
}
