// Test setup - runs before all tests
import { loadEnv } from "@/config/env";

// Set test environment variables before loading env
process.env.NODE_ENV = "test";
process.env.PORT = "8001";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-characters-long";
process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
process.env.SMTP_HOST = "smtp.test.com";
process.env.SMTP_PORT = "587";
process.env.SMTP_USER = "test@test.com";
process.env.SMTP_PASS = "test-password";
process.env.SMTP_FROM = "noreply@test.com";
process.env.FRONTEND_URL = "http://localhost:3000";

// Load environment with test values
loadEnv();
