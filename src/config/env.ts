/**
 * Environment configuration with validation.
 * Required vars are validated at startup.
 */
function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(getEnv("PORT", "3000"), 10),
  databaseUrl: getEnv("DATABASE_URL"),
} as const;

export function validateEnv(): void {
  getEnv("DATABASE_URL");
}
