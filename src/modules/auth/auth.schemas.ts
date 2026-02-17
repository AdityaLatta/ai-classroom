import { z } from "zod";
// Import directly to avoid circular dependency with swagger -> auth.docs -> auth.schemas
import { emailSchema, passwordSchema } from "@/infra/openapi";
import { stripHtml } from "@/utils";

export const googleLoginSchema = z
  .object({
    idToken: z
      .string()
      .min(1, "ID token is required")
      .openapi({ description: "Google OAuth ID token" }),
  })
  .openapi("GoogleLoginInput");

export const refreshTokenSchema = z
  .object({
    refreshToken: z
      .string()
      .min(1, "Refresh token is required")
      .optional()
      .openapi({ description: "Valid refresh token (optional if sent via cookie)" }),
  })
  .openapi("RefreshTokenInput");

export const logoutSchema = z
  .object({
    refreshToken: z
      .string()
      .min(1, "Refresh token is required")
      .optional()
      .openapi({ description: "Refresh token to revoke (optional if sent via cookie)" }),
  })
  .openapi("LogoutInput");

export const sessionIdParamSchema = z
  .object({
    sessionId: z
      .string()
      .uuid("Invalid session ID")
      .openapi({ description: "Session ID to revoke" }),
  })
  .openapi("SessionIdParam");

// --- Email/Password Auth Schemas ---

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema.openapi({
      description: "Min 8 chars, must contain uppercase, lowercase, and digit",
      minLength: 8,
      maxLength: 72,
    }),
    name: z.string().min(1, "Name is required").max(255).transform(stripHtml),
  })
  .openapi("RegisterInput");

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, "Password is required"),
  })
  .openapi("LoginInput");

export const verifyEmailSchema = z
  .object({
    token: z.string().min(1, "Token is required"),
  })
  .openapi("VerifyEmailInput");

export const resendVerificationSchema = z
  .object({
    email: emailSchema,
  })
  .openapi("ResendVerificationInput");

export const forgotPasswordSchema = z
  .object({
    email: emailSchema,
  })
  .openapi("ForgotPasswordInput");

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token is required"),
    password: passwordSchema.openapi({
      description: "New password",
      minLength: 8,
      maxLength: 72,
    }),
  })
  .openapi("ResetPasswordInput");

export const setPasswordSchema = z
  .object({
    password: passwordSchema.openapi({
      description: "Password to set for OAuth account",
      minLength: 8,
      maxLength: 72,
    }),
  })
  .openapi("SetPasswordInput");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema.openapi({
      description: "New password",
      minLength: 8,
      maxLength: 72,
    }),
  })
  .openapi("ChangePasswordInput");

export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
