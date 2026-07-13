#!/usr/bin/env node

import { pathToFileURL } from "node:url";

export const SECRET_OUTPUT_PATTERNS = {
  authorizationCredential:
    /\b(?:proxy-)?authorization\s*[:=]\s*(?:basic|bearer)\s+(?!\[redacted\])[^\s,;"']+/giu,
  bearerCredential: /\bBearer\s+(?!\[redacted\])[A-Za-z0-9._~+/=-]{16,}/giu,
  connectionStringWithCredentials:
    /\b[a-z][a-z0-9+.-]*:\/\/(?!\[redacted\]@)[^\s/@]+@/giu,
  cookie: /\b(?:set-cookie|cookie)\s*:\s*(?!\s*\[redacted\](?:\s|$))[^\r\n]+/giu,
  jwt: /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\b/gu,
  prefixedApiKey:
    /\b(?:fugue_[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})\b/giu,
  privateKey: /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/gu,
  querySecret:
    /[?&](?:access_?token|api_?key|auth|authorization|client_?secret|code|credential|jwt|key|password|private_?key|refresh_?token|secret|session|signature|token)=(?!\[redacted\](?:&|#|\s|$))[^&#\s"']+/giu,
  secretAssignment:
    /\b(?:api[_-]?key|auth[_-]?session[_-]?secret|client[_-]?secret|credential|database[_-]?url|dsn|fugue[_-]?(?:api[_-]?key|bootstrap[_-]?key)|github[_-]?(?:auth[_-]?client[_-]?secret|token)|google[_-]?client[_-]?secret|jwt|password|private[_-]?key|refresh[_-]?token|resend[_-]?api[_-]?key|secret|session[_-]?token|token|workspace[_-]?store[_-]?secret)\s*[=:]\s*(?!\[redacted(?:\]|\s))\S+/giu,
};

export function scanSecretOutput(input) {
  const value = String(input);
  const findings = Object.fromEntries(
    Object.entries(SECRET_OUTPUT_PATTERNS).map(([name, pattern]) => [
      name,
      Array.from(value.matchAll(new RegExp(pattern.source, pattern.flags))).length,
    ]),
  );
  const total = Object.values(findings).reduce((sum, count) => sum + count, 0);

  return { findings, total };
}

async function readStdin() {
  return new Promise((resolve, reject) => {
    let value = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      value += chunk;
    });
    process.stdin.on("end", () => resolve(value));
    process.stdin.on("error", reject);
  });
}

async function main() {
  const result = scanSecretOutput(await readStdin());
  process.stdout.write(`${JSON.stringify(result)}\n`);

  if (result.total > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
