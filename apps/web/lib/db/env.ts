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

type DbPrefix = "DB" | "POSTGRES";

function hasAnyPrefixedEnv(prefix: DbPrefix) {
  const keys =
    prefix === "DB"
      ? ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"]
      : [
          "POSTGRES_HOST",
          "POSTGRES_PORT",
          "POSTGRES_DB",
          "POSTGRES_USER",
          "POSTGRES_PASSWORD",
        ];

  return keys.some((key) => readOptionalEnv(key) !== null);
}

function buildDatabaseUrlFromPrefix(prefix: DbPrefix) {
  const userKey = prefix === "DB" ? "DB_USER" : "POSTGRES_USER";
  const passwordKey = prefix === "DB" ? "DB_PASSWORD" : "POSTGRES_PASSWORD";
  const databaseKey = prefix === "DB" ? "DB_NAME" : "POSTGRES_DB";
  const hostKey = prefix === "DB" ? "DB_HOST" : "POSTGRES_HOST";
  const portKey = prefix === "DB" ? "DB_PORT" : "POSTGRES_PORT";

  const user = encodeURIComponent(readRequiredEnv(userKey));
  const password = encodeURIComponent(readRequiredEnv(passwordKey));
  const database = encodeURIComponent(readRequiredEnv(databaseKey));
  const host = readOptionalEnv(hostKey) ?? "127.0.0.1";
  const port = readOptionalEnv(portKey) ?? "5432";

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

function buildDatabaseUrl() {
  const explicit = readOptionalEnv("DATABASE_URL");

  if (explicit) {
    return explicit;
  }

  if (hasAnyPrefixedEnv("DB")) {
    return buildDatabaseUrlFromPrefix("DB");
  }

  return buildDatabaseUrlFromPrefix("POSTGRES");
}

export function getDbEnv() {
  return {
    databaseUrl: buildDatabaseUrl(),
  };
}
