export function readPositiveSessionVersion(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    return null;
  }

  return value as number;
}

export function isCurrentSessionVersion(
  claimedVersion: unknown,
  storedVersion: unknown,
) {
  const claim = readPositiveSessionVersion(claimedVersion);
  const current = readPositiveSessionVersion(storedVersion);

  return claim !== null && current !== null && claim === current;
}

export type SessionAuthorizationRejection = {
  message: string;
  reason: "blocked" | "deleted" | "missing-user" | "stale-version";
  status: 401 | 403;
};

export function evaluateSessionAuthorization(input: {
  claimedVersion: unknown;
  storedVersion?: unknown;
  userStatus?: "active" | "blocked" | "deleted";
}): SessionAuthorizationRejection | null {
  if (!input.userStatus) {
    return {
      message: "Session user no longer exists.",
      reason: "missing-user",
      status: 401,
    };
  }

  if (input.userStatus === "blocked") {
    return {
      message: "User account is blocked.",
      reason: "blocked",
      status: 403,
    };
  }

  if (input.userStatus === "deleted") {
    return {
      message: "User account is deleted.",
      reason: "deleted",
      status: 403,
    };
  }

  if (!isCurrentSessionVersion(input.claimedVersion, input.storedVersion)) {
    return {
      message: "Session has been revoked. Sign in again.",
      reason: "stale-version",
      status: 401,
    };
  }

  return null;
}
