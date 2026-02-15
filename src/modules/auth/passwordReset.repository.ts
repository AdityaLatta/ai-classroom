import { BaseTokenRepository } from "./baseToken.repository";
import { IPasswordResetRepository } from "./auth.types";

export class PasswordResetRepository
  extends BaseTokenRepository
  implements IPasswordResetRepository
{
  constructor() {
    super("password_reset_tokens", 60 * 60 * 1000); // 1 hour
  }
}
