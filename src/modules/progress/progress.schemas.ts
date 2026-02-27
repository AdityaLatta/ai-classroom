import { z } from "zod";
import "@/infra/openapi";

export const lessonIdParamSchema = z
  .object({
    lessonId: z
      .string()
      .uuid("Invalid lesson ID format")
      .openapi({ description: "Lesson ID" }),
  })
  .openapi("ProgressLessonIdParam");

export const courseIdParamSchema = z
  .object({
    courseId: z
      .string()
      .uuid("Invalid course ID format")
      .openapi({ description: "Course ID" }),
  })
  .openapi("ProgressCourseIdParam");

export const updateProgressSchema = z
  .object({
    status: z
      .enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"])
      .openapi({ description: "Lesson progress status" }),
    progressPercent: z
      .number()
      .int()
      .min(0, "Progress must be >= 0")
      .max(100, "Progress must be <= 100")
      .openapi({ description: "Progress percentage (0-100)" }),
  })
  .openapi("UpdateProgressInput");

export type UpdateProgressInput = z.infer<typeof updateProgressSchema>;
