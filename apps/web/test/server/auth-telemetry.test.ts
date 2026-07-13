import { afterEach, expect, test } from "bun:test";

import {
  logAuthEmailDeliveryFailure,
  logAuthEmailDeliverySuccess,
  logAuthRateLimitDecision,
  logOAuthCallbackRejection,
} from "../../lib/auth/telemetry";

const originalConsoleError = console.error;
const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;

afterEach(() => {
  console.error = originalConsoleError;
  console.info = originalConsoleInfo;
  console.warn = originalConsoleWarn;
});

test("OAuth callback telemetry is reason-coded and identifier-free", () => {
  const output: string[] = [];
  console.warn = ((value: string) => output.push(value)) as typeof console.warn;

  logOAuthCallbackRejection({
    provider: "github",
    reason: "state-not-consumable",
  });

  expect(output).toHaveLength(1);
  expect(JSON.parse(output[0] as string)).toEqual({
    event: "fugue_web_oauth_callback",
    outcome: "rejected",
    provider: "github",
    reason: "state-not-consumable",
    stage: "callback",
  });
  expect(output[0]).not.toContain("nonce");
  expect(output[0]).not.toContain("transaction");
});

test("email delivery telemetry allow-lists error categories", () => {
  const output: string[] = [];
  console.error = ((value: string) => output.push(value)) as typeof console.error;

  logAuthEmailDeliveryFailure({
    category: "secret-bearing-provider-message",
    flow: "password-signup",
  });

  expect(JSON.parse(output[0] as string)).toEqual({
    category: "unknown",
    event: "fugue_web_auth_email",
    flow: "password-signup",
    outcome: "failed",
    stage: "delivery",
  });
  expect(output[0]).not.toContain("secret-bearing-provider-message");
});

test("email and rate-limit telemetry provide identifier-free denominators", () => {
  const infoOutput: string[] = [];
  const warnOutput: string[] = [];
  console.info = ((value: string) => infoOutput.push(value)) as typeof console.info;
  console.warn = ((value: string) => warnOutput.push(value)) as typeof console.warn;

  logAuthEmailDeliverySuccess({ flow: "email-link" });
  logAuthRateLimitDecision({ outcome: "allowed", policy: "email-start" });
  logAuthRateLimitDecision({ outcome: "limited", policy: "email-start" });

  expect(infoOutput.map((value) => JSON.parse(value))).toEqual([
    {
      event: "fugue_web_auth_email",
      flow: "email-link",
      outcome: "sent",
      stage: "delivery",
    },
    {
      event: "fugue_web_auth_rate_limit",
      outcome: "allowed",
      policy: "email-start",
    },
  ]);
  expect(JSON.parse(warnOutput[0] as string)).toEqual({
    event: "fugue_web_auth_rate_limit",
    outcome: "limited",
    policy: "email-start",
  });
  expect([...infoOutput, ...warnOutput].join(" ")).not.toContain("email@");
});
