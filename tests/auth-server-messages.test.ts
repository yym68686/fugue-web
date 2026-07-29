import assert from "node:assert/strict";
import test from "node:test";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_TOO_LONG_MESSAGE,
  PASSWORD_TOO_SHORT_MESSAGE,
} from "@/lib/auth/password-policy";
import {
  KNOWN_SERVER_MESSAGES,
  listServerMessageCatalogKeys,
  translateServerMessage,
} from "@/lib/auth/server-messages";
import { zhCN } from "@/lib/i18n/messages";
import { createTranslator, type MessageCatalog } from "@/lib/i18n/translate";

const en = createTranslator("en");
const zh = createTranslator("zh-CN");
// zhCN's inferred type is a literal record; index it as the catalog it satisfies.
const catalog: MessageCatalog = zhCN;

// The sign-up form can only localize server text that the catalog covers. An
// allowlisted string with no catalog entry silently renders English to Chinese
// users, which is how the old hard-coded allowlist drifted.
test("every allowlisted server message has a Chinese translation", () => {
  const missing = listServerMessageCatalogKeys().filter((key) => !catalog[key]);

  assert.deepEqual(
    missing,
    [],
    `server messages missing from lib/i18n/messages.ts: ${missing.join(", ")}`,
  );
});

test("the password errors the API actually sends are translated", () => {
  for (const message of [PASSWORD_TOO_SHORT_MESSAGE, PASSWORD_TOO_LONG_MESSAGE]) {
    const output = translateServerMessage(message, zh);

    assert.notEqual(output, message, `${message} was not translated`);
    assert.doesNotMatch(output, /\{(min|max)\}/, `${message} left a placeholder`);
  }

  assert.match(
    translateServerMessage(PASSWORD_TOO_SHORT_MESSAGE, zh),
    new RegExp(`\\b${PASSWORD_MIN_LENGTH}\\b`),
  );
  assert.match(
    translateServerMessage(PASSWORD_TOO_LONG_MESSAGE, zh),
    new RegExp(`\\b${PASSWORD_MAX_LENGTH}\\b`),
  );
});

test("English renders the policy numbers from the source strings", () => {
  assert.equal(
    translateServerMessage(PASSWORD_TOO_SHORT_MESSAGE, en),
    `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
  );
});

test("unknown server text passes through untouched", () => {
  const novel = "Some future error the catalog has never seen.";

  assert.equal(translateServerMessage(novel, zh), novel);
});

test("status codes leaked into thrown messages are stripped", () => {
  assert.equal(
    translateServerMessage("400 Keep at least one sign-in method on the account.", zh),
    zhCN["Keep at least one sign-in method on the account."],
  );
  // A message that merely starts with a number must not be mangled.
  assert.equal(
    translateServerMessage("2026 is not a valid year.", en),
    "2026 is not a valid year.",
  );
});

test("blank server text yields an empty string, not whitespace", () => {
  assert.equal(translateServerMessage("   ", zh), "");
});

test("the allowlist has no duplicate entries", () => {
  assert.equal(
    new Set(KNOWN_SERVER_MESSAGES).size,
    KNOWN_SERVER_MESSAGES.length,
    "KNOWN_SERVER_MESSAGES contains duplicates",
  );
});
