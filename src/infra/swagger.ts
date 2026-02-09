// src/infra/swagger.ts
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";
import { getEnv } from "../config/env";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "AI Classroom API",
      version: "1.0.0",
      description: "Backend API for AI Classroom application",
      contact: {
        name: "Aditya Latta",
      },
    },
    servers: [
      {
        url: "/api",
        description: "API base path",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT access token",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            requestId: { type: "string", format: "uuid" },
          },
        },
        ValidationError: {
          type: "object",
          properties: {
            error: { type: "string", example: "Validation failed" },
            details: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
        PaginationMeta: {
          type: "object",
          properties: {
            total: { type: "integer", description: "Total number of items" },
            limit: { type: "integer", description: "Items per page" },
            offset: { type: "integer", description: "Current offset" },
            hasMore: {
              type: "boolean",
              description: "Whether more items exist",
            },
          },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            email: { type: "string", format: "email" },
            name: { type: "string" },
            role: { type: "string", enum: ["STUDENT", "INSTRUCTOR", "ADMIN"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Course: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            title: { type: "string" },
            description: { type: "string" },
            instructorId: { type: "string", format: "uuid" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        AuthTokens: {
          type: "object",
          properties: {
            accessToken: { type: "string" },
            refreshToken: { type: "string" },
            expiresIn: {
              type: "integer",
              description: "Access token expiry in seconds",
            },
            user: { $ref: "#/components/schemas/User" },
          },
        },
        Session: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            deviceInfo: { type: "string", nullable: true },
            ipAddress: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            lastUsedAt: { type: "string", format: "date-time", nullable: true },
          },
        },
      },
    },
  },
  apis: ["./src/modules/**/*.routes.ts", "./src/docs/*.yaml"],
};

let swaggerSpec: object | null = null;

function getSwaggerSpec(): object {
  if (!swaggerSpec) {
    swaggerSpec = swaggerJsdoc(options);
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
