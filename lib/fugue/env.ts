import "server-only";

type FugueScopeLabel = "bootstrap" | "tenant" | "api";

export type FugueEnv = {
  apiHost: string;
  apiUrl: string;
  apiServerHost: string;
  apiServerUrl: string;
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

function readOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

const DEFAULT_INTERNAL_API_URL = "http://fugue-fugue.fugue-system.svc.cluster.local/";

function shouldUseInternalApi(publicApiUrl: string) {
  if (!process.env.KUBERNETES_SERVICE_HOST) {
    return false;
  }

  const hostname = new URL(publicApiUrl).hostname;
  return hostname === "api.fugue.pro";
}

function readApiServerUrl(publicApiUrl: string) {
  const explicitInternalApiUrl = readOptionalEnv("FUGUE_API_INTERNAL_URL");

  if (explicitInternalApiUrl) {
    return normalizeApiUrl(explicitInternalApiUrl);
  }

  if (shouldUseInternalApi(publicApiUrl)) {
    return DEFAULT_INTERNAL_API_URL;
  }

  return publicApiUrl;
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
  const apiServerUrl = readApiServerUrl(apiUrl);
  const bootstrapKey = readRequiredEnv("FUGUE_BOOTSTRAP_KEY");
  const apiHost = new URL(apiUrl).host;
  const apiServerHost = new URL(apiServerUrl).host;

  return {
    apiHost,
    apiUrl,
    apiServerHost,
    apiServerUrl,
    bootstrapKey,
    scopeLabel: deriveScopeLabel(bootstrapKey),
  };
}
