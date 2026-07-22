const CLIENT_ERROR_MIN = 400;
const CLIENT_ERROR_MAX = 499;

export const PUBLIC_ERROR_MAX_LENGTH = 240;
export const PUBLIC_ERROR_FALLBACK = "Request failed.";
export const PUBLIC_SERVER_ERROR = "The service is temporarily unavailable. Try again.";

const PRIVATE_KEY_BLOCK =
  /-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z0-9]+ )?PRIVATE KEY-----|$)/giu;
const PRIVATE_KEY_MARKER = /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/giu;
const AUTHORIZATION_CREDENTIAL =
  /\b((?:proxy-)?authorization\s*[:=]\s*(?:basic|bearer)\s+)[^\s,;"']+/giu;
const BEARER_CREDENTIAL = /\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/giu;
const COOKIE_HEADER = /\b((?:set-cookie|cookie)\s*:)\s*[^\r\n]+/giu;
const URL_USER_INFO = /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/giu;
const QUERY_SECRET =
  /([?&](?:access_?token|api_?key|auth|authorization|client_?secret|code|credential|jwt|key|password|private_?key|refresh_?token|secret|session|signature|token)=)[^&#\s"']*/giu;
const SECRET_ASSIGNMENT =
  /\b((?:api[_-]?key|auth[_-]?session[_-]?secret|client[_-]?secret|cookie|credential|database[_-]?url|dsn|fugue[_-]?(?:api[_-]?key|bootstrap[_-]?key)|github[_-]?(?:auth[_-]?client[_-]?secret|token)|google[_-]?client[_-]?secret|jwt|password|private[_-]?key|refresh[_-]?token|resend[_-]?api[_-]?key|secret|session[_-]?token|token|workspace[_-]?store[_-]?secret)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu;
const JWT = /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\b/gu;
const PREFIXED_API_KEY =
  /\b(?:fugue_[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})\b/giu;

function readMessage(value) {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Error) {
    return value.message;
  }

  if (value && typeof value === "object") {
    const message = Reflect.get(value, "message");

    if (typeof message === "string") {
      return message;
    }

    const error = Reflect.get(value, "error");

    if (typeof error === "string") {
      return error;
    }
  }

  return "";
}

function isClientErrorStatus(status) {
  return (
    Number.isInteger(status) && status >= CLIENT_ERROR_MIN && status <= CLIENT_ERROR_MAX
  );
}

export function readPublicErrorStatus(value, fallback = 500) {
  if (value && typeof value === "object") {
    const status = Reflect.get(value, "status");

    if (
      typeof status === "number" &&
      Number.isInteger(status) &&
      status >= 400 &&
      status <= 599
    ) {
      return status;
    }
  }

  const match = readMessage(value).match(/\b([45]\d{2})\b/u);
  const status = match ? Number(match[1]) : fallback;

  return status >= 400 && status <= 599 ? status : fallback;
}

function truncate(value) {
  const characters = Array.from(value);

  if (characters.length <= PUBLIC_ERROR_MAX_LENGTH) {
    return value;
  }

  return `${characters.slice(0, PUBLIC_ERROR_MAX_LENGTH - 1).join("")}…`;
}

function replaceControlCharacters(value) {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || codePoint === 0x7f ? " " : character;
  }).join("");
}

export function redactPublicErrorSecrets(value) {
  return String(value)
    .replace(PRIVATE_KEY_BLOCK, "[redacted private key]")
    .replace(PRIVATE_KEY_MARKER, "[redacted private key]")
    .replace(AUTHORIZATION_CREDENTIAL, "$1[redacted]")
    .replace(BEARER_CREDENTIAL, "$1[redacted]")
    .replace(COOKIE_HEADER, "$1 [redacted]")
    .replace(URL_USER_INFO, "$1[redacted]@")
    .replace(QUERY_SECRET, "$1[redacted]")
    .replace(SECRET_ASSIGNMENT, "$1[redacted]")
    .replace(JWT, "[redacted jwt]")
    .replace(PREFIXED_API_KEY, "[redacted api key]");
}

export function sanitizePublicErrorMessage(value, status) {
  if (typeof status === "number" && status >= 500 && status <= 599) {
    return PUBLIC_SERVER_ERROR;
  }

  if (!isClientErrorStatus(status)) {
    return PUBLIC_ERROR_FALLBACK;
  }

  const message = readMessage(value);

  if (!message.trim()) {
    return PUBLIC_ERROR_FALLBACK;
  }

  const redacted = replaceControlCharacters(redactPublicErrorSecrets(message))
    .replace(/\s+/gu, " ")
    .trim();

  return redacted ? truncate(redacted) : PUBLIC_ERROR_FALLBACK;
}
