import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";
import { getEnv } from "../config/env";
import { authRegistry } from "../modules/auth/auth.docs";
import { courseRegistry } from "../modules/courses/course.docs";

// --- Shared response schemas ---

const ErrorSchema = z
  .object({
    error: z.string(),
    requestId: z.string().uuid(),
  })
  .openapi("Error");

const ValidationErrorSchema = z
  .object({
    error: z.string().openapi({ example: "Validation failed" }),
    details: z.array(
      z.object({
        field: z.string(),
        message: z.string(),
      }),
    ),
  })
  .openapi("ValidationError");

const PaginationMetaSchema = z
  .object({
    total: z.number().int().openapi({ description: "Total number of items" }),
    limit: z.number().int().openapi({ description: "Items per page" }),
    offset: z.number().int().openapi({ description: "Current offset" }),
    hasMore: z.boolean().openapi({ description: "Whether more items exist" }),
    nextCursor: z.string().optional().openapi({ description: "Cursor for the next page" }),
  })
  .openapi("PaginationMeta");

const UserSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    role: z.enum(["STUDENT", "INSTRUCTOR", "ADMIN"]),
    createdAt: z.string().datetime(),
  })
  .openapi("User");

const CourseSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string(),
    instructorId: z.string().uuid(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Course");

const AuthTokensSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresIn: z.number().int().openapi({ description: "Access token expiry in seconds" }),
    user: UserSchema,
  })
  .openapi("AuthTokens");

const SessionSchema = z
  .object({
    id: z.string().uuid(),
    deviceInfo: z.string().nullable(),
    ipAddress: z.string().nullable(),
    createdAt: z.string().datetime(),
    lastUsedAt: z.string().datetime().nullable(),
  })
  .openapi("Session");

// --- Build merged registry ---

const registry = new OpenAPIRegistry([authRegistry, courseRegistry]);

// Register shared schemas so they appear in components/schemas
registry.register("Error", ErrorSchema);
registry.register("ValidationError", ValidationErrorSchema);
registry.register("PaginationMeta", PaginationMetaSchema);
registry.register("User", UserSchema);
registry.register("Course", CourseSchema);
registry.register("AuthTokens", AuthTokensSchema);
registry.register("Session", SessionSchema);

// --- Generate spec ---

let swaggerSpec: object | null = null;

function getSwaggerSpec(): object {
  if (!swaggerSpec) {
    const generator = new OpenApiGeneratorV3(registry.definitions);
    swaggerSpec = generator.generateDocument({
      openapi: "3.0.0",
      info: {
        title: "AI Classroom API",
        version: "1.0.0",
        description: "Backend API for AI Classroom application",
        contact: { name: "Aditya Latta" },
      },
      servers: [{ url: "/api", description: "API base path" }],
      security: [],
    });

    // Inject security schemes (generator doesn't have a built-in option for this)
    (swaggerSpec as any).components = (swaggerSpec as any).components || {};
    (swaggerSpec as any).components.securitySchemes = {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Enter your JWT access token",
      },
    };
  }
  return swaggerSpec;
}

export function setupSwagger(app: Express): void {
  const env = getEnv();

  // Serve Swagger JSON spec
  app.get("/api/docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(getSwaggerSpec());
  });

  // Serve Swagger UI
  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(getSwaggerSpec(), {
      customSiteTitle: "AI Classroom API Docs",
      customCss: ".swagger-ui .topbar { display: none }",
      swaggerOptions: {
        persistAuthorization: true,
      },
    }),
  );

  if (env.NODE_ENV !== "production") {
    console.log(`📚 API docs available at /api/docs`);
  }
}

export { getSwaggerSpec };
