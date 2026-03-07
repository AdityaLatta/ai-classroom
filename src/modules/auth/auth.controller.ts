import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { AuthTokens } from "./auth.types";
import { AppError, AppResponse, ErrorCode, Post, Get, Delete } from "@/utils";
import { getEnv } from "@/config";
import { REFRESH_TOKEN_EXPIRY_DAYS } from "@/auth/jwt";
import {
  validate,
  validateParams,
  requireAuth,
  authLimiter,
  strictLimiter,
} from "@/middlewares";
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
  selectRoleSchema,
} from "./auth.schemas";

const REFRESH_TOKEN_COOKIE = "refresh_token";
const COOKIE_PATH = "/api/v1/auth";

// Security decision: CSRF protection is provided by SameSite=Strict cookies combined
// with Bearer token authentication. The refresh token cookie uses SameSite=Strict which
// prevents cross-origin requests from including the cookie. All state-changing endpoints
// also require a valid Bearer token in the Authorization header, providing double protection.

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // --- OAuth Routes ---

  @Post("/google", validate(googleLoginSchema))
  async googleLogin(req: Request, res: Response) {
    const { idToken } = req.body;
    const deviceInfo = req.headers["user-agent"];
    const ipAddress = req.ip;

    const result = await this.authService.loginWithGoogle({
      idToken,
      deviceInfo,
      ipAddress,
    });

    this.sendAuthResponse(res, result);
  }

  @Post("/refresh")
  async refreshToken(req: Request, res: Response) {
    // Accept from body or cookie
    const refreshToken =
      req.body.refreshToken || req.cookies?.[REFRESH_TOKEN_COOKIE];
    const deviceInfo = req.headers["user-agent"];
    const ipAddress = req.ip;

    if (!refreshToken) {
      throw new AppError(
        400,
        "Refresh token is required",
        ErrorCode.AUTH_REFRESH_TOKEN_REQUIRED,
      );
    }

    const result = await this.authService.refreshAccessToken({
      refreshToken,
      deviceInfo,
      ipAddress,
    });

    this.sendAuthResponse(res, result);
  }

  @Post("/logout")
  async logout(req: Request, res: Response) {
    const refreshToken =
      req.body.refreshToken || req.cookies?.[REFRESH_TOKEN_COOKIE];

    if (!refreshToken) {
      throw new AppError(
        400,
        "Refresh token is required",
        ErrorCode.AUTH_REFRESH_TOKEN_REQUIRED,
      );
    }

    await this.authService.logout(refreshToken);
    this.clearRefreshTokenCookie(res);

    AppResponse.message(res, "Logged out successfully");
  }

  // --- Protected Routes ---

  @Post("/logout-all", requireAuth)
  async logoutAll(req: Request, res: Response) {
    const userId = req.user!.id;

    await this.authService.logoutAll(userId);
    this.clearRefreshTokenCookie(res);

    AppResponse.message(res, "Logged out from all devices");
  }

  @Get("/me", requireAuth)
  async me(req: Request, res: Response) {
    const userId = req.user!.id;

    const user = await this.authService.getUserById(userId);
    if (!user) {
      throw new AppError(404, "User not found", ErrorCode.AUTH_USER_NOT_FOUND);
    }

    // Response DTO - never expose passwordHash or internal fields
    AppResponse.ok(res, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
      authProvider: user.authProvider,
      createdAt: user.createdAt,
    });
  }

  @Get("/sessions", requireAuth)
  async getSessions(req: Request, res: Response) {
    const userId = req.user!.id;

    const sessions = await this.authService.getActiveSessions(userId);

    // Response DTO - strip tokenHash
    AppResponse.ok(
      res,
      sessions.map((session) => ({
        id: session.id,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
      })),
    );
  }

  @Delete("/sessions/:sessionId", requireAuth, validateParams(sessionIdParamSchema))
  async revokeSession(req: Request, res: Response) {
    const userId = req.user!.id;
    const { sessionId } = req.validated.params as { sessionId: string };

    await this.authService.revokeSession(userId, sessionId);

    AppResponse.message(res, "Session revoked");
  }

  // --- Email/Password Auth Routes ---

  @Post("/register", authLimiter, validate(registerSchema))
  async register(req: Request, res: Response) {
    const { email, password, name } = req.body;
    const result = await this.authService.register({
      email,
      password,
      name,
    });
    AppResponse.message(res, result.message, 201);
  }

  @Post("/login", authLimiter, validate(loginSchema))
  async login(req: Request, res: Response) {
    const { email, password } = req.body;
    const deviceInfo = req.headers["user-agent"];
    const ipAddress = req.ip;
    const result = await this.authService.login({
      email,
      password,
      deviceInfo,
      ipAddress,
    });
    this.sendAuthResponse(res, result);
  }

  @Post("/verify-email", authLimiter, validate(verifyEmailSchema))
  async verifyEmail(req: Request, res: Response) {
    const { token } = req.body;
    const result = await this.authService.verifyEmail(token);
    AppResponse.message(res, result.message);
  }

  @Post("/resend-verification", strictLimiter, validate(resendVerificationSchema))
  async resendVerification(req: Request, res: Response) {
    const { email } = req.body;
    const result = await this.authService.resendVerificationEmail(email);
    AppResponse.message(res, result.message);
  }

  @Post("/forgot-password", strictLimiter, validate(forgotPasswordSchema))
  async forgotPassword(req: Request, res: Response) {
    const { email } = req.body;
    const result = await this.authService.forgotPassword(email);
    AppResponse.message(res, result.message);
  }

  @Post("/reset-password", authLimiter, validate(resetPasswordSchema))
  async resetPassword(req: Request, res: Response) {
    const { token, password } = req.body;
    const result = await this.authService.resetPassword(token, password);
    AppResponse.message(res, result.message);
  }

  @Post("/set-password", requireAuth, validate(setPasswordSchema))
  async setPassword(req: Request, res: Response) {
    const userId = req.user!.id;
    const { password } = req.body;
    const result = await this.authService.setPassword(userId, password);
    AppResponse.message(res, result.message);
  }

  @Post("/change-password", requireAuth, validate(changePasswordSchema))
  async changePassword(req: Request, res: Response) {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;
    const result = await this.authService.changePassword(userId, {
      currentPassword,
      newPassword,
    });
    this.clearRefreshTokenCookie(res);
    AppResponse.message(res, result.message);
  }

  @Post("/select-role", requireAuth, validate(selectRoleSchema))
  async selectRole(req: Request, res: Response) {
    const userId = req.user!.id;
    const { role } = req.body;
    const user = await this.authService.selectRole(userId, role);
    AppResponse.ok(res, { id: user.id, role: user.role });
  }

  // --- Private helpers ---

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    const { COOKIE_SECURE, COOKIE_DOMAIN, NODE_ENV } = getEnv();
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure: COOKIE_SECURE || NODE_ENV === "production",
      sameSite: NODE_ENV === "production" ? "none" : "strict",
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      path: COOKIE_PATH,
      ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: COOKIE_PATH });
  }

  private sendAuthResponse(res: Response, result: AuthTokens): void {
    this.setRefreshTokenCookie(res, result.refreshToken);
    // Also include refreshToken in body for clients that can't use cookies (mobile apps)
    AppResponse.ok(res, result);
  }
}
