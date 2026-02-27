import { z } from "zod";
import "@/infra/openapi";
import { stripHtml } from "@/utils";

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
    status: z
      .enum(["DRAFT", "PUBLISHED", "ARCHIVED"])
      .optional()
      .openapi({ description: "Course status" }),
    thumbnailUrl: z
      .string()
      .url("Invalid thumbnail URL")
      .optional()
      .openapi({ description: "Course thumbnail URL" }),
    category: z
      .string()
      .max(100, "Category must be at most 100 characters")
      .trim()
      .transform(stripHtml)
      .optional()
      .openapi({ description: "Course category" }),
    difficulty: z
      .enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"])
      .optional()
      .openapi({ description: "Course difficulty level" }),
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
    status: z
      .enum(["DRAFT", "PUBLISHED", "ARCHIVED"])
      .optional()
      .openapi({ description: "Filter by course status" }),
    category: z
      .string()
      .max(100)
      .optional()
      .openapi({ description: "Filter by category" }),
    difficulty: z
      .enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"])
      .optional()
      .openapi({ description: "Filter by difficulty" }),
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
    status: z
      .enum(["DRAFT", "PUBLISHED", "ARCHIVED"])
      .optional()
      .openapi({ description: "Course status" }),
    thumbnailUrl: z
      .string()
      .url("Invalid thumbnail URL")
      .nullable()
      .optional()
      .openapi({ description: "Course thumbnail URL" }),
    category: z
      .string()
      .max(100, "Category must be at most 100 characters")
      .trim()
      .transform(stripHtml)
      .nullable()
      .optional()
      .openapi({ description: "Course category" }),
    difficulty: z
      .enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"])
      .nullable()
      .optional()
      .openapi({ description: "Course difficulty level" }),
  })
  .openapi("UpdateCourseInput");

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;
