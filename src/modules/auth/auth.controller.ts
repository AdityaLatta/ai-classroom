import { Request, Response } from "express";
import { AuthService, AuthTokens } from "./auth.service";
import { AppError } from "../../utils/AppError";
import { ErrorCode } from "../../utils/errorCodes";
import { asyncHandler } from "../../utils/asyncHandler";
import { getEnv } from "../../config/env";
import { REFRESH_TOKEN_EXPIRY_DAYS } from "../../auth/jwt";

const REFRESH_TOKEN_COOKIE = "refresh_token";
const COOKIE_PATH = "/api/auth";

// Security decision: CSRF protection is provided by SameSite=Strict cookies combined
// with Bearer token authentication. The refresh token cookie uses SameSite=Strict which
// prevents cross-origin requests from including the cookie. All state-changing endpoints
// also require a valid Bearer token in the Authorization header, providing double protection.

function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  const { COOKIE_SECURE, COOKIE_DOMAIN, NODE_ENV } = getEnv();
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: COOKIE_SECURE || NODE_ENV === "production",
    sameSite: "strict",
    maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    path: COOKIE_PATH,
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  });
}

function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE, { path: COOKIE_PATH });
}

function sendAuthResponse(res: Response, result: AuthTokens, status = 200): void {
  setRefreshTokenCookie(res, result.refreshToken);
  // Also include refreshToken in body for clients that can't use cookies (mobile apps)
  res.status(status).json({ data: result });
}

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  googleLogin = asyncHandler(async (req: Request, res: Response) => {
    const { idToken } = req.body;
    const deviceInfo = req.headers["user-agent"];
    const ipAddress = req.ip;

    const result = await this.authService.loginWithGoogle({
      idToken,
      deviceInfo,
      ipAddress,
    });

    sendAuthResponse(res, result);
  });

  refreshToken = asyncHandler(async (req: Request, res: Response) => {
    // Accept from body or cookie
    const refreshToken =
      req.body.refreshToken || req.cookies?.[REFRESH_TOKEN_COOKIE];
    const deviceInfo = req.headers["user-agent"];
    const ipAddress = req.ip;

    if (!refreshToken) {
      throw new AppError(400, "Refresh token is required", ErrorCode.AUTH_REFRESH_TOKEN_REQUIRED);
    }

    const result = await this.authService.refreshAccessToken({
      refreshToken,
      deviceInfo,
      ipAddress,
    });

    sendAuthResponse(res, result);
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken =
      req.body.refreshToken || req.cookies?.[REFRESH_TOKEN_COOKIE];

    if (!refreshToken) {
      throw new AppError(400, "Refresh token is required", ErrorCode.AUTH_REFRESH_TOKEN_REQUIRED);
    }

    await this.authService.logout(refreshToken);
    clearRefreshTokenCookie(res);

    res.json({ message: "Logged out successfully" });
  });

  logoutAll = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    await this.authService.logoutAll(userId);
    clearRefreshTokenCookie(res);

    res.json({ message: "Logged out from all devices" });
  });

  me = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const user = await this.authService.getUserById(userId);
    if (!user) {
      throw new AppError(404, "User not found", ErrorCode.AUTH_USER_NOT_FOUND);
    }

    // Response DTO - never expose passwordHash or internal fields
    res.json({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        authProvider: user.authProvider,
        createdAt: user.createdAt,
      },
    });
  });

  getSessions = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const sessions = await this.authService.getActiveSessions(userId);

    // Response DTO - strip tokenHash
    res.json({
      data: sessions.map((session) => ({
        id: session.id,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
      })),
    });
  });

  revokeSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { sessionId } = req.validated.params as { sessionId: string };

    await this.authService.revokeSession(userId, sessionId);

    res.json({ message: "Session revoked" });
  });

  register = asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name } = req.body;
    const result = await this.authService.register({
      email,
      password,
      name,
    });
    res.status(201).json(result);
  });

  login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const deviceInfo = req.headers["user-agent"];
    const ipAddress = req.ip;
    const result = await this.authService.login({
      email,
      password,
      deviceInfo,
      ipAddress,
    });
    sendAuthResponse(res, result);
  });

  verifyEmail = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.body;
    const result = await this.authService.verifyEmail(token);
    res.json(result);
  });

  resendVerification = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    const result = await this.authService.resendVerificationEmail(email);
    res.json(result);
  });

  forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    const result = await this.authService.forgotPassword(email);
    res.json(result);
  });

  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { token, password } = req.body;
    const result = await this.authService.resetPassword(token, password);
    res.json(result);
  });

  setPassword = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { password } = req.body;
    const result = await this.authService.setPassword(userId, password);
    res.json(result);
  });

  changePassword = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;
    const result = await this.authService.changePassword(userId, {
      currentPassword,
      newPassword,
    });
    clearRefreshTokenCookie(res);
    res.json(result);
  });
}
