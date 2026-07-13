export const PUBLIC_ERROR_MAX_LENGTH: 240;
export const PUBLIC_ERROR_FALLBACK: "Request failed.";
export const PUBLIC_SERVER_ERROR: "The service is temporarily unavailable. Try again.";

export function redactPublicErrorSecrets(value: unknown): string;
export function readPublicErrorStatus(value: unknown, fallback?: number): number;
export function sanitizePublicErrorMessage(value: unknown, status?: number): string;
