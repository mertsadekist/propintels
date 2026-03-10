function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  // Database
  DATABASE_URL: requireEnv("DATABASE_URL"),

  // Auth
  NEXTAUTH_SECRET: requireEnv("NEXTAUTH_SECRET"),
  NEXTAUTH_URL: requireEnv("NEXTAUTH_URL"),

  // Redis
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",

  // Storage
  STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT ?? "",
  STORAGE_BUCKET: process.env.STORAGE_BUCKET ?? "",
  STORAGE_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY ?? "",
  STORAGE_SECRET_KEY: process.env.STORAGE_SECRET_KEY ?? "",
  STORAGE_REGION: process.env.STORAGE_REGION ?? "auto",

  // Email
  EMAIL_API_KEY: process.env.EMAIL_API_KEY ?? "",
  EMAIL_FROM: process.env.EMAIL_FROM ?? "noreply@example.com",

  // Security
  CAPTCHA_SECRET: process.env.CAPTCHA_SECRET ?? "",

  // App
  APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  NODE_ENV: process.env.NODE_ENV ?? "development",
  IS_PRODUCTION: process.env.NODE_ENV === "production",
};
