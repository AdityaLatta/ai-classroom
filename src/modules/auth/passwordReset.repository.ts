import { PoolClient } from "pg";
import { BaseTokenRepository, TokenRecord } from "./baseToken.repository";

export type PasswordResetToken = TokenRecord;

export interface IPasswordResetRepository {
  create(userId: string): Promise<string>;
  findValidByRawToken(rawToken: string): Promise<PasswordResetToken | null>;
  markUsed(id: string, client?: PoolClient): Promise<void>;
  deleteExpired(): Promise<number>;
}

export class PasswordResetRepository
  extends BaseTokenRepository
  implements IPasswordResetRepository
{
  constructor() {
    super("password_reset_tokens", 60 * 60 * 1000); // 1 hour
  }
}
