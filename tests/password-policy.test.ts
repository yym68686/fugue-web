import assert from "node:assert/strict";
import test from "node:test";

import {
  checkPasswordPolicy,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_LENGTH_HINT_KEY,
  PASSWORD_TOO_LONG_MESSAGE,
  PASSWORD_TOO_SHORT_MESSAGE,
} from "@/lib/auth/password-policy";
import { validatePassword } from "@/lib/auth/password";
import { zhCN } from "@/lib/i18n/messages";
import { createTranslator } from "@/lib/i18n/translate";

test("minimum-length boundary is exactly PASSWORD_MIN_LENGTH", () => {
  const tooShort = "a".repeat(PASSWORD_MIN_LENGTH - 1);
  const justLongEnough = "a".repeat(PASSWORD_MIN_LENGTH);

  assert.equal(checkPasswordPolicy(tooShort), PASSWORD_TOO_SHORT_MESSAGE);
  assert.equal(checkPasswordPolicy(justLongEnough), null);
});

test("maximum-length boundary is exactly PASSWORD_MAX_LENGTH", () => {
  assert.equal(checkPasswordPolicy("a".repeat(PASSWORD_MAX_LENGTH)), null);
  assert.equal(
    checkPasswordPolicy("a".repeat(PASSWORD_MAX_LENGTH + 1)),
    PASSWORD_TOO_LONG_MESSAGE,
  );
});

test("whitespace-only passwords are rejected even when long enough", () => {
  assert.equal(
    checkPasswordPolicy(" ".repeat(PASSWORD_MIN_LENGTH)),
    "Enter a password.",
  );
});

test("the server validator and the shared policy cannot diverge", () => {
  for (const length of [0, 1, PASSWORD_MIN_LENGTH - 1, PASSWORD_MIN_LENGTH, 64]) {
    const password = "a".repeat(length);
    assert.equal(
      validatePassword(password),
      checkPasswordPolicy(password),
      `validatePassword disagreed with the policy at length ${length}`,
    );
  }
});

// The original bug: the sign-up hint said 8 while the API enforced 10. Both now
// interpolate PASSWORD_MIN_LENGTH, so assert no literal digit is hard-coded.
test("the sign-up hint states the enforced minimum in both locales", () => {
  for (const locale of ["en", "zh-CN"] as const) {
    const t = createTranslator(locale);
    const hint = t(PASSWORD_MIN_LENGTH_HINT_KEY, { min: PASSWORD_MIN_LENGTH });

    assert.match(
      hint,
      new RegExp(`\\b${PASSWORD_MIN_LENGTH}\\b`),
      `${locale} hint omitted the minimum: ${hint}`,
    );
    assert.doesNotMatch(hint, /\{min\}/, `${locale} hint left {min} uninterpolated`);
  }
});

test("the hint template carries a placeholder rather than a baked-in number", () => {
  assert.match(PASSWORD_MIN_LENGTH_HINT_KEY, /\{min\}/);
  assert.match(zhCN[PASSWORD_MIN_LENGTH_HINT_KEY], /\{min\}/);
});
