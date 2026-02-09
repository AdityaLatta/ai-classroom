// src/modules/auth/auth.controller.ts
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { AppError } from "../../utils/AppError";
import { asyncHandler } from "../../utils/asyncHandler";

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

    res.json(result);
  });

  refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    const deviceInfo = req.headers["user-agent"];
    const ipAddress = req.ip;

    const result = await this.authService.refreshAccessToken({
      refreshToken,
      deviceInfo,
      ipAddress,
    });

    res.json(result);
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError(400, "Refresh token is required", "AUTH_REFRESH_TOKEN_REQUIRED");
    }

    await this.authService.logout(refreshToken);

    res.json({ message: "Logged out successfully" });
  });

  logoutAll = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    await this.authService.logoutAll(userId);

    res.json({ message: "Logged out from all devices" });
  });

  me = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const user = await this.authService.getUserById(userId);
    if (!user) {
      throw new AppError(404, "User not found", "AUTH_USER_NOT_FOUND");
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    });
  });

  getSessions = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const sessions = await this.authService.getActiveSessions(userId);

    res.json(
      sessions.map((session) => ({
        id: session.id,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
      })),
    );
  });

  revokeSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const sessionId = req.params.sessionId as string;

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
    res.json(result);
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
}
