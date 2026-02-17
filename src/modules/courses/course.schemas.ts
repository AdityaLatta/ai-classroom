import { z } from "zod";
import "@/infra/openapi";
import { stripHtml } from "@/utils/sanitize";

export const createCourseSchema = z
  .object({
    title: z
      .string()
      .min(3, "Title must be at least 3 characters")
      .max(200, "Title must be at most 200 characters")
      .trim()
      .transform(stripHtml)
      .openapi({ description: "Course title", minLength: 3, maxLength: 200 }),
    description: z
      .string()
      .min(10, "Description must be at least 10 characters")
      .max(5000, "Description must be at most 5000 characters")
      .trim()
      .transform(stripHtml)
      .openapi({ description: "Course description", minLength: 10, maxLength: 5000 }),
  })
  .openapi("CreateCourseInput");

export const courseIdSchema = z
  .object({
    id: z
      .string()
      .uuid("Invalid course ID format")
      .openapi({ description: "Course ID" }),
  })
  .openapi("CourseIdParam");

export const listCoursesQuerySchema = z
  .object({
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .openapi({ description: "Number of items per page" }),
    offset: z.coerce
      .number()
      .int()
      .min(0)
      .optional()
      .default(0)
      .openapi({ description: "Number of items to skip" }),
    search: z
      .string()
      .max(200)
      .optional()
      .openapi({ description: "Search term for title/description" }),
    instructorId: z
      .string()
      .uuid()
      .optional()
      .openapi({ description: "Filter by instructor ID" }),
    cursor: z
      .string()
      .datetime()
      .optional()
      .openapi({ description: "Cursor for pagination (ISO datetime of last item)" }),
  })
  .openapi("ListCoursesQuery");

export const updateCourseSchema = z
  .object({
    title: z
      .string()
      .min(3, "Title must be at least 3 characters")
      .max(200, "Title must be at most 200 characters")
      .trim()
      .transform(stripHtml)
      .optional()
      .openapi({ description: "Course title", minLength: 3, maxLength: 200 }),
    description: z
      .string()
      .min(10, "Description must be at least 10 characters")
      .max(5000, "Description must be at most 5000 characters")
      .trim()
      .transform(stripHtml)
      .optional()
      .openapi({ description: "Course description", minLength: 10, maxLength: 5000 }),
  })
  .openapi("UpdateCourseInput");

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;
