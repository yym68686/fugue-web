import "server-only";

function readOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function readRequiredEnv(name: string) {
  const value = readOptionalEnv(name);

  if (!value) {
    throw new Error(`Missing required database environment variable: ${name}`);
  }

  return value;
}

function buildDatabaseUrl() {
  const explicit = readOptionalEnv("DATABASE_URL");

  if (explicit) {
    return explicit;
  }

  const user = encodeURIComponent(readRequiredEnv("POSTGRES_USER"));
  const password = encodeURIComponent(readRequiredEnv("POSTGRES_PASSWORD"));
  const database = encodeURIComponent(readRequiredEnv("POSTGRES_DB"));
  const host = readOptionalEnv("POSTGRES_HOST") ?? "127.0.0.1";
  const port = readOptionalEnv("POSTGRES_PORT") ?? "5432";

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

export function getDbEnv() {
  return {
    databaseUrl: buildDatabaseUrl(),
  };
}
