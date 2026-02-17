import { logger } from "@/utils/logger";

export type AuditAction =
  | "USER_REGISTERED"
  | "USER_LOGIN"
  | "USER_LOGIN_FAILED"
  | "USER_LOGOUT"
  | "USER_LOGOUT_ALL"
  | "USER_GOOGLE_LOGIN"
  | "TOKEN_REFRESHED"
  | "EMAIL_VERIFIED"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED"
  | "PASSWORD_SET"
  | "PASSWORD_CHANGED"
  | "SESSION_REVOKED"
  | "ACCOUNT_LOCKED"
  | "COURSE_CREATED"
  | "COURSE_UPDATED"
  | "COURSE_DELETED";

interface AuditEntry {
  action: AuditAction;
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

const auditLog = logger.child({ component: "audit" });

export function audit(entry: AuditEntry): void {
  auditLog.info(entry, `AUDIT: ${entry.action}`);
}
