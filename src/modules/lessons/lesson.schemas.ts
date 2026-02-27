import { z } from "zod";
import "@/infra/openapi";
import { stripHtml } from "@/utils";

export const lessonParamsSchema = z
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
  .openapi("LessonParams");

export const lessonIdParamsSchema = z
  .object({
    courseId: z
      .string()
      .uuid("Invalid course ID format")
      .openapi({ description: "Course ID" }),
    moduleId: z
      .string()
      .uuid("Invalid module ID format")
      .openapi({ description: "Module ID" }),
    lessonId: z
      .string()
      .uuid("Invalid lesson ID format")
      .openapi({ description: "Lesson ID" }),
  })
  .openapi("LessonIdParams");

export const createLessonSchema = z
  .object({
    title: z
      .string()
      .min(3, "Title must be at least 3 characters")
      .max(200, "Title must be at most 200 characters")
      .trim()
      .transform(stripHtml)
      .openapi({ description: "Lesson title", minLength: 3, maxLength: 200 }),
    type: z
      .enum(["TEXT", "VIDEO", "LIVE_CLASS"])
      .openapi({ description: "Lesson type" }),
    description: z
      .string()
      .max(2000, "Description must be at most 2000 characters")
      .trim()
      .transform(stripHtml)
      .optional()
      .openapi({ description: "Lesson description", maxLength: 2000 }),
    content: z
      .string()
      .max(50000, "Content must be at most 50000 characters")
      .optional()
      .openapi({ description: "Text content for TEXT type lessons" }),
    videoUrl: z
      .string()
      .url("Invalid video URL")
      .optional()
      .openapi({ description: "Video URL for VIDEO type lessons" }),
    durationMinutes: z
      .number()
      .int()
      .min(1, "Duration must be at least 1 minute")
      .optional()
      .openapi({ description: "Estimated duration in minutes" }),
  })
  .openapi("CreateLessonInput");

export const updateLessonSchema = z
  .object({
    title: z
      .string()
      .min(3, "Title must be at least 3 characters")
      .max(200, "Title must be at most 200 characters")
      .trim()
      .transform(stripHtml)
      .optional()
      .openapi({ description: "Lesson title" }),
    type: z
      .enum(["TEXT", "VIDEO", "LIVE_CLASS"])
      .optional()
      .openapi({ description: "Lesson type" }),
    description: z
      .string()
      .max(2000, "Description must be at most 2000 characters")
      .trim()
      .transform(stripHtml)
      .nullable()
      .optional()
      .openapi({ description: "Lesson description" }),
    content: z
      .string()
      .max(50000, "Content must be at most 50000 characters")
      .nullable()
      .optional()
      .openapi({ description: "Text content" }),
    videoUrl: z
      .string()
      .url("Invalid video URL")
      .nullable()
      .optional()
      .openapi({ description: "Video URL" }),
    durationMinutes: z
      .number()
      .int()
      .min(1, "Duration must be at least 1 minute")
      .nullable()
      .optional()
      .openapi({ description: "Duration in minutes" }),
  })
  .openapi("UpdateLessonInput");

export const reorderLessonsSchema = z
  .object({
    lessons: z
      .array(
        z.object({
          id: z.string().uuid("Invalid lesson ID"),
          order: z.number().int().min(0, "Order must be >= 0"),
        }),
      )
      .min(1, "At least one lesson must be provided")
      .openapi({ description: "Array of lesson IDs with new order values" }),
  })
  .openapi("ReorderLessonsInput");

export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
export type ReorderLessonsInput = z.infer<typeof reorderLessonsSchema>;
