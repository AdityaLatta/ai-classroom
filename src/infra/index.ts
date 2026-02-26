// Barrel export for infra
export {
  getDb,
  initDb,
  closeDb,
  healthCheck,
  withTransaction,
  withClient,
} from "./db";
export {
  getMailer,
  sendEmail,
  verificationEmailHtml,
  passwordResetEmailHtml,
} from "./mailer";
export {
  initSentry,
  setupSentryErrorHandler,
  captureError,
  setUserContext,
  Sentry,
} from "./sentry";
export { setupSwagger, getSwaggerSpec } from "./swagger";
export { initWebSocket } from "./websocket";
export { emailSchema, passwordSchema, uuidSchema } from "./openapi";
export { eventBus } from "./eventBus";
export type { DomainEventMap } from "./eventBus";
export { instrumentPool, getQueryStats } from "./instrumentedPool";
export {
  runWithContext,
  getContext,
  tryGetContext,
  enrichContext,
} from "./requestContext";
export type { RequestContext, QueryStats } from "./requestContext";
