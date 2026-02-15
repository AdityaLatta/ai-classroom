import { BaseTokenRepository } from "./baseToken.repository";
import { IEmailVerificationRepository } from "./auth.types";

export class EmailVerificationRepository
  extends BaseTokenRepository
  implements IEmailVerificationRepository
{
  constructor() {
    super("email_verification_tokens", 24 * 60 * 60 * 1000); // 24 hours
  }
}
