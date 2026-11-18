export const integrationServices = [
  { name: "GitHub sign-in", keys: ["GITHUB_AUTH_CLIENT_SECRET"] },
  { name: "GitHub repository OAuth", keys: ["GITHUB_OAUTH_CLIENT_SECRET"] },
  { name: "GitHub App", keys: ["GITHUB_APP_PRIVATE_KEY", "GITHUB_APP_WEBHOOK_SECRET"] },
  { name: "Google sign-in", keys: ["GOOGLE_CLIENT_SECRET"] },
  { name: "Resend", keys: ["RESEND_API_KEY"] },
  { name: "Creem", keys: ["CREEM_API_KEY", "CREEM_WEBHOOK_SECRET"] },
] as const;

export type IntegrationKey = (typeof integrationServices)[number]["keys"][number];
const keys: ReadonlySet<string> = new Set(integrationServices.flatMap(({ keys }) => [...keys]));

export function parseIntegrationSettings(value: unknown): { integration: IntegrationKey; secret: string | null } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.integration !== "string" || !keys.has(input.integration) || Object.keys(input).length !== 2) return null;
  const integration = input.integration as IntegrationKey;
  if (input.secret === null) return { integration, secret: null };
  if (typeof input.secret !== "string" || input.secret.length > 8192) return null;
  const secret = input.secret.trim();
  if (!secret || (integration !== "GITHUB_APP_PRIVATE_KEY" && /[\s\u0000-\u001f\u007f]/u.test(secret))) return null;
  return { integration, secret };
}
