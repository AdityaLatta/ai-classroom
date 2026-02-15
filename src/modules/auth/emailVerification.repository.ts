import { PoolClient } from "pg";
import { BaseTokenRepository, TokenRecord } from "./baseToken.repository";

export type EmailVerificationToken = TokenRecord;

export interface IEmailVerificationRepository {
  create(userId: string): Promise<string>;
  findValidByRawToken(rawToken: string): Promise<EmailVerificationToken | null>;
  markUsed(id: string, client?: PoolClient): Promise<void>;
  deleteExpired(): Promise<number>;
}

export class EmailVerificationRepository
  extends BaseTokenRepository
  implements IEmailVerificationRepository
{
  constructor() {
    super("email_verification_tokens", 24 * 60 * 60 * 1000); // 24 hours
  }
}
