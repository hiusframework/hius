// Reads and validates required environment variables at startup.
// Fail fast: throw immediately if any required var is missing.

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`[Hius] Missing required env var: ${key}`);
  return value;
}

function optional(key: string): string | undefined {
  return process.env[key];
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  ENCRYPTION_KEY: required("ENCRYPTION_KEY"), // base64, 32 bytes
  HMAC_KEY: required("HMAC_KEY"), // base64, 32 bytes
  KEY_ID: required("KEY_ID"),
  ENABLE_DETERMINISTIC_ENCRYPTION: optional("ENABLE_DETERMINISTIC_ENCRYPTION") === "true",
} as const;
