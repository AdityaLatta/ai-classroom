import { BaseTokenRepository } from "./baseToken.repository";
import {
  PasswordResetToken,
  IPasswordResetRepository,
} from "./auth.types";

export type { PasswordResetToken, IPasswordResetRepository };

export class PasswordResetRepository
  extends BaseTokenRepository
  implements IPasswordResetRepository
{
  constructor() {
    super("password_reset_tokens", 60 * 60 * 1000); // 1 hour
  }
}
