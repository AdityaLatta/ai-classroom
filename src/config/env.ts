import dotenv from "dotenv";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(8000),
  HOST_URL: z.string().url().optional(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters for security"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  // SMTP / Email
  SMTP_HOST: z.string().min(1, "SMTP_HOST is required"),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().min(1, "SMTP_USER is required"),
  SMTP_PASS: z.string().min(1, "SMTP_PASS is required"),
  SMTP_FROM: z.string().email("SMTP_FROM must be a valid email"),
  FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL"),
  // CORS origins (comma-separated in production, e.g. "https://app.com,https://admin.app.com")
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((s) => s.trim()) : undefined)),
  // Database pool
  DB_POOL_MAX: z.coerce.number().default(10),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().default(30000),
  DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().default(5000),
  DB_SSL: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  DB_SSL_CA: z.string().optional(),
  // Observability
  SENTRY_DSN: z.string().url().optional(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  // Request timeout
  REQUEST_TIMEOUT_MS: z.coerce.number().default(30000),
  // Graceful shutdown
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().default(10000),
  // Account lockout
  LOGIN_MAX_ATTEMPTS: z.coerce.number().default(5),
  LOGIN_LOCKOUT_MINUTES: z.coerce.number().default(15),
  // Cookie settings
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  COOKIE_DOMAIN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

export function loadEnv(): Env {
  dotenv.config();

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors.map(
      (e) => `${e.path.join(".")}: ${e.message}`,
    );
    console.error("Invalid environment variables:", errors.join(", "));
    process.exit(1);
  }

  env = result.data;
  return env;
}

export function getEnv(): Env {
  if (!env) {
    throw new Error("Environment not loaded. Call loadEnv() first.");
  }
  return env;
}
