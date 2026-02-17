import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import "@/infra/openapi";
import {
  googleLoginSchema,
  refreshTokenSchema,
  logoutSchema,
  sessionIdParamSchema,
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  setPasswordSchema,
  changePasswordSchema,
} from "./auth.schemas";


export const authRegistry = new OpenAPIRegistry();

// --- Helper schemas for responses ---

const messageResponse = z.object({
  message: z.string(),
});

const authTokensRef = { $ref: "#/components/schemas/AuthTokens" };
const userRef = { $ref: "#/components/schemas/User" };
const sessionRef = { $ref: "#/components/schemas/Session" };
const validationErrorRef = { $ref: "#/components/schemas/ValidationError" };

// --- OAuth Routes ---

authRegistry.registerPath({
  method: "post",
  path: "/auth/google",
  tags: ["Auth"],
  summary: "Login with Google OAuth",
  description: "Authenticate user with Google ID token and receive JWT tokens",
  request: {
    body: { content: { "application/json": { schema: googleLoginSchema } }, required: true },
  },
  responses: {
    200: { description: "Successfully authenticated", content: { "application/json": { schema: authTokensRef as any } } },
    400: { description: "Validation error", content: { "application/json": { schema: validationErrorRef as any } } },
    401: { description: "Invalid Google token" },
  },
});

authRegistry.registerPath({
  method: "post",
  path: "/auth/refresh",
  tags: ["Auth"],
  summary: "Refresh access token",
  description: "Exchange a valid refresh token for new access and refresh tokens. Accepts token from body or httpOnly cookie.",
  request: {
    body: { content: { "application/json": { schema: refreshTokenSchema } }, required: false },
  },
  responses: {
    200: { description: "New tokens issued", content: { "application/json": { schema: authTokensRef as any } } },
    401: { description: "Invalid or expired refresh token" },
  },
});

authRegistry.registerPath({
  method: "post",
  path: "/auth/logout",
  tags: ["Auth"],
  summary: "Logout current session",
  description: "Revoke the provided refresh token and clear cookie",
  request: {
    body: { content: { "application/json": { schema: logoutSchema } }, required: false },
  },
  responses: {
    200: { description: "Successfully logged out", content: { "application/json": { schema: messageResponse } } },
  },
});

// --- Protected Routes ---

authRegistry.registerPath({
  method: "post",
  path: "/auth/logout-all",
  tags: ["Auth"],
  summary: "Logout from all devices",
  description: "Revoke all refresh tokens for the authenticated user",
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: "Successfully logged out from all devices", content: { "application/json": { schema: messageResponse } } },
    401: { description: "Unauthorized" },
  },
});

authRegistry.registerPath({
  method: "get",
  path: "/auth/me",
  tags: ["Auth"],
  summary: "Get current user profile",
  description: "Returns the authenticated user's profile information",
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: "User profile", content: { "application/json": { schema: userRef as any } } },
    401: { description: "Unauthorized" },
    404: { description: "User not found" },
  },
});

authRegistry.registerPath({
  method: "get",
  path: "/auth/sessions",
  tags: ["Auth"],
  summary: "Get active sessions",
  description: "Returns all active sessions for the authenticated user",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "List of active sessions",
      content: { "application/json": { schema: { type: "array", items: sessionRef } as any } },
    },
    401: { description: "Unauthorized" },
  },
});

authRegistry.registerPath({
  method: "delete",
  path: "/auth/sessions/{sessionId}",
  tags: ["Auth"],
  summary: "Revoke a session",
  description: "Revoke a specific session by ID",
  security: [{ BearerAuth: [] }],
  request: {
    params: sessionIdParamSchema,
  },
  responses: {
    200: { description: "Session revoked", content: { "application/json": { schema: messageResponse } } },
    401: { description: "Unauthorized" },
    404: { description: "Session not found" },
  },
});

// --- Email/Password Auth Routes ---

authRegistry.registerPath({
  method: "post",
  path: "/auth/register",
  tags: ["Auth"],
  summary: "Register with email and password",
  description: "Create a new account with email and password. A verification email will be sent.",
  request: {
    body: { content: { "application/json": { schema: registerSchema } }, required: true },
  },
  responses: {
    201: { description: "Registration successful (generic response to prevent enumeration)" },
    400: { description: "Validation error", content: { "application/json": { schema: validationErrorRef as any } } },
  },
});

authRegistry.registerPath({
  method: "post",
  path: "/auth/login",
  tags: ["Auth"],
  summary: "Login with email and password",
  description: "Authenticate with email and password and receive JWT tokens",
  request: {
    body: { content: { "application/json": { schema: loginSchema } }, required: true },
  },
  responses: {
    200: { description: "Successfully authenticated", content: { "application/json": { schema: authTokensRef as any } } },
    401: { description: "Invalid email or password" },
    403: { description: "Email not verified" },
    429: { description: "Account temporarily locked" },
  },
});

authRegistry.registerPath({
  method: "post",
  path: "/auth/verify-email",
  tags: ["Auth"],
  summary: "Verify email address",
  description: "Verify email address using the token sent via email",
  request: {
    body: { content: { "application/json": { schema: verifyEmailSchema } }, required: true },
  },
  responses: {
    200: { description: "Email verified successfully" },
    400: { description: "Invalid or expired token" },
  },
});

authRegistry.registerPath({
  method: "post",
  path: "/auth/resend-verification",
  tags: ["Auth"],
  summary: "Resend verification email",
  description: "Resend the email verification link",
  request: {
    body: { content: { "application/json": { schema: resendVerificationSchema } }, required: true },
  },
  responses: {
    200: { description: "Verification email sent (if account exists and is unverified)" },
  },
});

authRegistry.registerPath({
  method: "post",
  path: "/auth/forgot-password",
  tags: ["Auth"],
  summary: "Request password reset",
  description: "Send a password reset email",
  request: {
    body: { content: { "application/json": { schema: forgotPasswordSchema } }, required: true },
  },
  responses: {
    200: { description: "Password reset email sent (if account exists)" },
  },
});

authRegistry.registerPath({
  method: "post",
  path: "/auth/reset-password",
  tags: ["Auth"],
  summary: "Reset password",
  description: "Reset password using the token sent via email",
  request: {
    body: { content: { "application/json": { schema: resetPasswordSchema } }, required: true },
  },
  responses: {
    200: { description: "Password reset successfully" },
    400: { description: "Invalid or expired token" },
  },
});

authRegistry.registerPath({
  method: "post",
  path: "/auth/set-password",
  tags: ["Auth"],
  summary: "Set password for OAuth users",
  description: "Allow OAuth users to set a password for email/password login (account linking)",
  security: [{ BearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: setPasswordSchema } }, required: true },
  },
  responses: {
    200: { description: "Password set successfully" },
    401: { description: "Unauthorized" },
    409: { description: "Password already set" },
  },
});

authRegistry.registerPath({
  method: "post",
  path: "/auth/change-password",
  tags: ["Auth"],
  summary: "Change password",
  description: "Change password for users who already have one set. Requires current password.",
  security: [{ BearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: changePasswordSchema } }, required: true },
  },
  responses: {
    200: { description: "Password changed successfully. All sessions revoked." },
    400: { description: "No password set (use set-password instead)" },
    401: { description: "Current password is incorrect" },
  },
});
