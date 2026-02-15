import { Router } from "express";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { LoginAttemptTracker } from "./loginAttemptTracker";
import { UserRepository } from "../users/user.repository";
import { RefreshTokenRepository } from "./refreshToken.repository";
import { EmailVerificationRepository } from "./emailVerification.repository";
import { PasswordResetRepository } from "./passwordReset.repository";
import { validate, validateParams } from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/requireAuth";
import { authLimiter, strictLimiter } from "../../middlewares/rateLimiter";
import {
  googleLoginSchema,
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

// --- Composition root for auth module ---
const userRepository = new UserRepository();
const refreshTokenRepository = new RefreshTokenRepository();
const emailVerificationRepository = new EmailVerificationRepository();
const passwordResetRepository = new PasswordResetRepository();
export const loginAttemptTracker = new LoginAttemptTracker();
const authService = new AuthService(
  userRepository,
  refreshTokenRepository,
  emailVerificationRepository,
  passwordResetRepository,
  loginAttemptTracker,
);
const authController = new AuthController(authService);

const router = Router();

// --- OAuth Routes ---
router.post("/google", validate(googleLoginSchema), authController.googleLogin);
router.post("/refresh", authController.refreshToken);
router.post("/logout", authController.logout);

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
router.post(
  "/change-password",
  requireAuth,
  validate(changePasswordSchema),
  authController.changePassword,
);

export const authRouter = router;
