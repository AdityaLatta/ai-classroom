import { z } from "zod";
import "@/infra/openapi";

export const enrollCourseParamSchema = z
  .object({
    courseId: z
      .string()
      .uuid("Invalid course ID format")
      .openapi({ description: "Course ID" }),
  })
  .openapi("EnrollCourseParam");

export const myCoursesQuerySchema = z
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
    status: z
      .enum(["ACTIVE", "DROPPED"])
      .optional()
      .openapi({ description: "Filter by enrollment status" }),
  })
  .openapi("MyCoursesQuery");

export type MyCoursesQuery = z.infer<typeof myCoursesQuerySchema>;
