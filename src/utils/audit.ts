import { logger } from "./logger";
import { tryGetContext } from "@/infra/requestContext";

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
  | "ACCOUNT_LOCKED_CHECK"
  | "COURSE_CREATED"
  | "COURSE_UPDATED"
  | "COURSE_DELETED"
  | "MODULE_CREATED"
  | "MODULE_UPDATED"
  | "MODULE_DELETED"
  | "MODULE_REORDERED"
  | "LESSON_CREATED"
  | "LESSON_UPDATED"
  | "LESSON_DELETED"
  | "ENROLLMENT_CREATED"
  | "ENROLLMENT_DROPPED"
  | "PROGRESS_UPDATED"
  | "LESSON_COMPLETED";

interface AuditEntry {
  action: AuditAction;
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

// Lazy-init to avoid issues when logger is mocked in tests
let auditLog: ReturnType<typeof logger.child> | null = null;

function getAuditLog() {
  if (!auditLog) {
    auditLog = logger.child({ component: "audit" });
  }
  return auditLog;
}

export function audit(entry: AuditEntry): void {
  const ctx = tryGetContext();
  const enriched: AuditEntry = {
    ...entry,
    ip: entry.ip ?? ctx?.ip,
    userAgent: entry.userAgent ?? ctx?.userAgent,
    metadata: {
      ...entry.metadata,
      ...(ctx?.requestId ? { requestId: ctx.requestId } : {}),
    },
  };
  getAuditLog().info(enriched, `AUDIT: ${entry.action}`);
}
