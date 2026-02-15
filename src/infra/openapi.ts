import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

// Initialize once - all schema files import z from "zod" and get OpenAPI extensions
extendZodWithOpenApi(z);

// Shared reusable schemas
export const emailSchema = z
  .string()
  .email("Invalid email address")
  .openapi({ format: "email" });

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    "Password must contain at least one lowercase letter, one uppercase letter, and one digit",
  );

export const uuidSchema = z.string().uuid();
