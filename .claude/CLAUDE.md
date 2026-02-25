# AI Classroom — Backend

## Quick Commands
- `npm run dev` — start with nodemon (port 8000)
- `npm run build` — compile TypeScript to `dist/`
- `npm test` — Jest (run before committing)
- `npm run test:coverage` — coverage thresholds: 70% lines/functions/statements, 50% branches
- `npm run lint` — ESLint (flat config, TypeScript rules)
- `npm run format` — Prettier (double quotes, trailing commas, 2-space indent)
- `npm run migrate:latest` — run pending Knex migrations
- `npm run migrate:rollback` — rollback last batch
- `npm run migrate:make <name>` — create new migration

## Tech Stack
- **Runtime:** Node.js 20+, Express 5, TypeScript 5 (strict)
- **Database:** PostgreSQL 16, raw SQL via `pg` Pool (Knex for migrations only)
- **Auth:** JWT (jsonwebtoken), bcryptjs, Google Auth Library
- **Validation:** Zod 3
- **Logging:** Pino (JSON in prod, pretty in dev, silent in test)
- **Error tracking:** Sentry (`src/infra/sentry.ts`)
- **Email:** Nodemailer
- **Docs:** swagger-ui-express + zod-to-openapi

## Architecture

### Module structure (per feature):
```
src/modules/<feature>/
├── *.module.ts       — composition root (manual DI)
├── *.routes.ts       — Express route definitions
├── *.controller.ts   — HTTP request handlers
├── *.service.ts      — business logic
├── *.repository.ts   — data access (raw SQL + pg Pool)
├── *.types.ts        — TypeScript interfaces
├── *.schemas.ts      — Zod validation schemas
└── __tests__/        — colocated tests
```

### Key patterns
- **All route handlers** wrapped with `asyncHandler()` from `src/utils/asyncHandler.ts`
- **Errors:** throw `AppError(message, statusCode, code)` — caught by global `errorHandler`
- **Responses:** `AppResponse.success(res, data)` or `AppResponse.created(res, data)`
- **Validation middleware:** `validate({ body: schema })` from `src/middlewares/validate.ts`
- **Auth middleware:** `requireAuth` verifies JWT, `requireRole("ADMIN")` checks role
- **DB transactions:** `withTransaction(pool, async (client) => { ... })`

### Middleware pipeline order
requestId → timeout → helmet → cors → cookieParser → json → httpLogger → rateLimiter → csrf → routes → 404 → sentryErrorHandler → errorHandler

## Conventions
- Absolute imports via `@/*` alias (e.g., `import { getDb } from "@/infra"`)
- Unused variables: prefix with `_` (ESLint enforced)
- Error codes as constants in `src/utils/errorCodes.ts`
- Repositories return domain objects via `mapRow()` — never expose raw DB rows
- `src/config/env.ts` validates all env vars with Zod at startup

## Security
- Passwords: bcryptjs, 12 rounds
- Access tokens: 15min expiry, refresh tokens: 7 days (hashed in DB, rotated on use)
- Rate limiting: 100 req/15min global, 10/15min auth, 5/hr sensitive ops
- Account lockout: 5 failed attempts → 15min lockout (in-memory tracker)
- CSRF: SameSite=Strict cookies + Bearer token
- HTML sanitization on email templates

## CI
- GitHub Actions: lint → build → migrate → test:coverage
- PostgreSQL 16 service container for integration tests
