import { eventBus } from "@/infra/eventBus";
import { audit } from "@/utils";

export function registerAuthListeners(): void {
  eventBus.on("auth:google-login", (p) => {
    audit({ action: "USER_GOOGLE_LOGIN", userId: p.userId, email: p.email, ip: p.ip, userAgent: p.userAgent });
  });

  eventBus.on("auth:login", (p) => {
    audit({ action: "USER_LOGIN", userId: p.userId, email: p.email, ip: p.ip, userAgent: p.userAgent });
  });

  eventBus.on("auth:login-failed", (p) => {
    audit({ action: "USER_LOGIN_FAILED", email: p.email, ip: p.ip, metadata: { attemptNumber: p.attemptNumber } });
  });

  eventBus.on("auth:logout", (p) => {
    audit({ action: "USER_LOGOUT", userId: p.userId });
  });

  eventBus.on("auth:logout-all", (p) => {
    audit({ action: "USER_LOGOUT_ALL", userId: p.userId });
  });

  eventBus.on("auth:token-refreshed", (p) => {
    audit({ action: "TOKEN_REFRESHED", userId: p.userId, ip: p.ip });
  });

  eventBus.on("auth:registered", (p) => {
    audit({ action: "USER_REGISTERED", userId: p.userId, email: p.email });
  });

  eventBus.on("auth:email-verified", (p) => {
    audit({ action: "EMAIL_VERIFIED", userId: p.userId });
  });

  eventBus.on("auth:password-reset-requested", (p) => {
    audit({ action: "PASSWORD_RESET_REQUESTED", userId: p.userId, email: p.email });
  });

  eventBus.on("auth:password-reset-completed", (p) => {
    audit({ action: "PASSWORD_RESET_COMPLETED", userId: p.userId });
  });

  eventBus.on("auth:password-set", (p) => {
    audit({ action: "PASSWORD_SET", userId: p.userId });
  });

  eventBus.on("auth:password-changed", (p) => {
    audit({ action: "PASSWORD_CHANGED", userId: p.userId });
  });

  eventBus.on("auth:session-revoked", (p) => {
    audit({ action: "SESSION_REVOKED", userId: p.userId, metadata: { sessionId: p.sessionId } });
  });

  eventBus.on("auth:account-locked", (p) => {
    audit({ action: "ACCOUNT_LOCKED", email: p.email, ip: p.ip, metadata: { attempts: p.attempts, lockoutMinutes: p.lockoutMinutes } });
  });

  eventBus.on("auth:account-locked-check", (p) => {
    audit({ action: "ACCOUNT_LOCKED_CHECK", email: p.email, metadata: { minutesLeft: p.minutesLeft } });
  });
}
