// src/modules/auth/auth.routes.ts
import { Router } from "express";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { UserRepository } from "../users/user.repository";
import { RefreshTokenRepository } from "./refreshToken.repository";
import { EmailVerificationRepository } from "./emailVerification.repository";
import { PasswordResetRepository } from "./passwordReset.repository";
import { validate, validateParams } from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/requireAuth";
import { authLimiter, strictLimiter } from "../../middlewares/rateLimiter";
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
} from "./auth.schemas";

// Create instances
const userRepository = new UserRepository();
const refreshTokenRepository = new RefreshTokenRepository();
const emailVerificationRepository = new EmailVerificationRepository();
const passwordResetRepository = new PasswordResetRepository();
const authService = new AuthService(
  userRepository,
  refreshTokenRepository,
  emailVerificationRepository,
  passwordResetRepository,
);
const authController = new AuthController(authService);

const router = Router();

// --- OAuth Routes ---
router.post("/google", validate(googleLoginSchema), authController.googleLogin);
router.post("/refresh", validate(refreshTokenSchema), authController.refreshToken);
router.post("/logout", validate(logoutSchema), authController.logout);

// --- Protected Routes ---
router.post("/logout-all", requireAuth, authController.logoutAll);
router.get("/me", requireAuth, authController.me);
router.get("/sessions", requireAuth, authController.getSessions);
router.delete(
  "/sessions/:sessionId",
  requireAuth,
  validateParams(sessionIdParamSchema),
  authController.revokeSession,
);

// --- Email/Password Auth Routes ---
router.post("/register", authLimiter, validate(registerSchema), authController.register);
router.post("/login", authLimiter, validate(loginSchema), authController.login);
router.post("/verify-email", authLimiter, validate(verifyEmailSchema), authController.verifyEmail);
router.post(
  "/resend-verification",
  strictLimiter,
  validate(resendVerificationSchema),
  authController.resendVerification,
);
router.post(
  "/forgot-password",
  strictLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);
router.post(
  "/reset-password",
  authLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword,
);
router.post(
  "/set-password",
  requireAuth,
  validate(setPasswordSchema),
  authController.setPassword,
);

export const authRouter = router;
