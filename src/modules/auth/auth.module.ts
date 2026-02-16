import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { LoginAttemptTracker } from "./loginAttemptTracker";
import { UserRepository } from "../users/user.repository";
import { RefreshTokenRepository } from "./refreshToken.repository";
import { EmailVerificationRepository } from "./emailVerification.repository";
import { PasswordResetRepository } from "./passwordReset.repository";
import { TokenCleanupJob } from "../../jobs/tokenCleanup";
import { createAuthRouter } from "./auth.routes";

// --- Composition root for auth module ---
const userRepository = new UserRepository();
const refreshTokenRepository = new RefreshTokenRepository();
const emailVerificationRepository = new EmailVerificationRepository();
const passwordResetRepository = new PasswordResetRepository();
const loginAttemptTracker = new LoginAttemptTracker();
const tokenCleanupJob = new TokenCleanupJob(
  refreshTokenRepository,
  emailVerificationRepository,
  passwordResetRepository,
);
const authService = new AuthService(
  userRepository,
  refreshTokenRepository,
  emailVerificationRepository,
  passwordResetRepository,
  loginAttemptTracker,
);
const authController = new AuthController(authService);

export const authRouter = createAuthRouter(authController);

export const authModule = {
  start: () => {
    loginAttemptTracker.startCleanup();
    tokenCleanupJob.start();
  },
  stop: () => {
    loginAttemptTracker.stopCleanup();
    tokenCleanupJob.stop();
  },
};
