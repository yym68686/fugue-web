import "server-only";

export type OAuthCallbackRejectionReason =
  | "account-blocked"
  | "account-deleted"
  | "invalid-code"
  | "invalid-provider-profile"
  | "invalid-state"
  | "missing-browser-nonce"
  | "origin-mismatch"
  | "provider-denied"
  | "provider-exchange-failed"
  | "provisioning-failed"
  | "state-not-consumable"
  | "transaction-store-unavailable";

const SAFE_ERROR_CATEGORIES = new Set([
  "AbortError",
  "Error",
  "TimeoutError",
  "TypeError",
]);

export function logAuthEmailDeliveryFailure(input: {
  category: string;
  flow: "email-link" | "password-signup";
}) {
  console.error(
    JSON.stringify({
      category: SAFE_ERROR_CATEGORIES.has(input.category) ? input.category : "unknown",
      event: "fugue_web_auth_email",
      flow: input.flow,
      outcome: "failed",
      stage: "delivery",
    }),
  );
}

export function logOAuthCallbackRejection(input: {
  outcome?: "rejected" | "unavailable";
  provider: "github" | "google";
  reason: OAuthCallbackRejectionReason;
}) {
  console.warn(
    JSON.stringify({
      event: "fugue_web_oauth_callback",
      outcome: input.outcome ?? "rejected",
      provider: input.provider,
      reason: input.reason,
      stage: "callback",
    }),
  );
}
