import { z } from "zod";
import "@/infra/openapi";
import { stripHtml } from "@/utils";

export const courseIdParamSchema = z
  .object({
    courseId: z
      .string()
      .uuid("Invalid course ID format")
      .openapi({ description: "Course ID" }),
  })
  .openapi("CourseIdParam");

export const moduleIdParamSchema = z
  .object({
    courseId: z
      .string()
      .uuid("Invalid course ID format")
      .openapi({ description: "Course ID" }),
    moduleId: z
      .string()
      .uuid("Invalid module ID format")
      .openapi({ description: "Module ID" }),
  })
  .openapi("ModuleIdParam");

export const createModuleSchema = z
  .object({
    title: z
      .string()
      .min(3, "Title must be at least 3 characters")
      .max(200, "Title must be at most 200 characters")
      .trim()
      .transform(stripHtml)
      .openapi({ description: "Module title", minLength: 3, maxLength: 200 }),
    description: z
      .string()
      .max(2000, "Description must be at most 2000 characters")
      .trim()
      .transform(stripHtml)
      .optional()
      .openapi({ description: "Module description", maxLength: 2000 }),
  })
  .openapi("CreateModuleInput");

export const updateModuleSchema = z
  .object({
    title: z
      .string()
      .min(3, "Title must be at least 3 characters")
      .max(200, "Title must be at most 200 characters")
      .trim()
      .transform(stripHtml)
      .optional()
      .openapi({ description: "Module title", minLength: 3, maxLength: 200 }),
    description: z
      .string()
      .max(2000, "Description must be at most 2000 characters")
      .trim()
      .transform(stripHtml)
      .nullable()
      .optional()
      .openapi({ description: "Module description", maxLength: 2000 }),
  })
  .openapi("UpdateModuleInput");

export const reorderModulesSchema = z
  .object({
    modules: z
      .array(
        z.object({
          id: z.string().uuid("Invalid module ID"),
          order: z.number().int().min(0, "Order must be >= 0"),
        }),
      )
      .min(1, "At least one module must be provided")
      .openapi({ description: "Array of module IDs with new order values" }),
  })
  .openapi("ReorderModulesInput");

export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
export type ReorderModulesInput = z.infer<typeof reorderModulesSchema>;
