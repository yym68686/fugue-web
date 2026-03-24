import "server-only";

type FugueScopeLabel = "bootstrap" | "tenant" | "api";

export type FugueEnv = {
  apiHost: string;
  apiUrl: string;
  bootstrapKey: string;
  scopeLabel: FugueScopeLabel;
};

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function normalizeApiUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function deriveScopeLabel(key: string): FugueScopeLabel {
  if (key.startsWith("fugue_bootstrap")) {
    return "bootstrap";
  }

  if (key.startsWith("fugue_tenant")) {
    return "tenant";
  }

  return "api";
}

export function getFugueEnv(): FugueEnv {
  const apiUrl = normalizeApiUrl(readRequiredEnv("FUGUE_API_URL"));
  const bootstrapKey = readRequiredEnv("FUGUE_BOOTSTRAP_KEY");
  const apiHost = new URL(apiUrl).host;

  return {
    apiHost,
    apiUrl,
    bootstrapKey,
    scopeLabel: deriveScopeLabel(bootstrapKey),
  };
}
